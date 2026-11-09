const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { contraste, lancarNavegador } = require("./ui.cjs");

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function pronto(url) {
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(processos, argumentos, env = process.env) {
  const processo = spawn(process.execPath, argumentos, { windowsHide: true, stdio: "pipe", env });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (erro) => process.stderr.write(erro));
  processos.push(processo);
}

let browser;
let temporario;
const processos = [];

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-splash-"));
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar(processos, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

  browser = await lancarNavegador();
  const errosJs = [];
  const abrir = async (opcoes = {}) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opcoes });
    const page = await context.newPage();
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    return { context, page, splash: page.locator(".e-splash") };
  };

  // 1. Primeira entrada: aparece, é decorativo, não recebe cliques e some em até 1 s.
  {
    const { context, page, splash } = await abrir();
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached", timeout: 5000 });
    const apareceu = Date.now();
    assert.equal(await splash.getAttribute("aria-hidden"), "true");
    assert.equal(await splash.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
    await splash.waitFor({ state: "detached", timeout: 1500 });
    assert.ok(Date.now() - apareceu <= 1000, `splash durou ${Date.now() - apareceu} ms`);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("pixel:splash-visto")), "1");
    console.log("OK: a primeira entrada mostra o splash decorativo, sem capturar cliques, por até 1 s");

    // 2. Recarga na mesma aba: não aparece.
    await page.reload();
    await page.locator("main h1").waitFor();
    assert.equal(await splash.count(), 0);
    console.log("OK: recarregar na mesma aba não repete o splash");
    await context.close();
  }

  // 3. Clique durante a abertura chega ao app.
  {
    const { context, page, splash } = await abrir();
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Nova tarefa" }).click();
    await page.getByRole("dialog", { name: "Nova tarefa" }).waitFor();
    console.log("OK: o clique durante a abertura chega ao app");
    await context.close();
  }

  // 4. Movimento reduzido: não aparece.
  {
    const { context, page, splash } = await abrir({ reducedMotion: "reduce" });
    await page.goto(`${web}/quadro`);
    await page.locator("main h1").waitFor();
    assert.equal(await splash.count(), 0);
    await page.waitForTimeout(300);
    assert.equal(await splash.count(), 0);
    console.log("OK: com movimento reduzido o splash não aparece");
    await context.close();
  }

  // 5. sessionStorage bloqueado: aparece, some e não gera erro.
  {
    const { context, page, splash } = await abrir();
    await context.addInitScript(() => Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("bloqueado", "SecurityError"); } }));
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached", timeout: 5000 });
    await splash.waitFor({ state: "detached", timeout: 1500 });
    await page.locator("main h1").waitFor();
    console.log("OK: com sessionStorage bloqueado o splash aparece, some e não quebra");
    await context.close();
  }

  // 6. Contraste e largura nos dois temas, em 320 px.
  for (const esquema of ["light", "dark"]) {
    const { context, page, splash } = await abrir({ viewport: { width: 320, height: 700 }, colorScheme: esquema });
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached", timeout: 5000 });
    const medidas = await page.evaluate(() => {
      const nome = document.querySelector(".e-splash-nome");
      const raiz = document.querySelector(".e-splash");
      if (!nome || !raiz) return null;
      return { texto: getComputedStyle(nome).color, fundo: getComputedStyle(raiz).backgroundColor, cabe: document.documentElement.scrollWidth <= innerWidth };
    });
    assert.ok(medidas, `splash sumiu antes da medição (${esquema})`);
    assert.ok(contraste(medidas.texto, medidas.fundo) >= 4.5, `${esquema}: ${medidas.texto} sobre ${medidas.fundo}`);
    assert.equal(medidas.cabe, true, `${esquema}: rolagem horizontal`);
    await context.close();
  }
  console.log("OK: o nome tem contraste nos dois temas e o splash cabe em 320 px");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("6 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  for (const processo of processos) {
    if (processo.exitCode === null) {
      const terminou = new Promise((resolve) => processo.once("exit", resolve));
      processo.kill();
      await terminou;
    }
  }
  if (temporario) await rm(temporario, { recursive: true, force: true });
});
