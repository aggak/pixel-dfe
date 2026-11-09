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

  browser = await lancarNavegador({ splash: true });
  const errosJs = [];
  const abrir = async (opcoes = {}) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opcoes });
    const page = await context.newPage();
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    return { context, page, splash: page.locator(".e-splash") };
  };

  // 1. Primeira entrada: aparece, é decorativo, recebe cliques e some entre 2 e 3 s.
  {
    const { context, page, splash } = await abrir();
    // Mede dentro da página: inserção, remoção e fim da animação de saída.
    await context.addInitScript(() => {
      window.__splash = { inserido: null, removido: null, animacaoFim: false };
      document.addEventListener("animationend", (e) => { if (e.animationName === "e-splash-sair") window.__splash.animacaoFim = true; }, true);
      new MutationObserver(() => {
        const existe = !!document.querySelector(".e-splash");
        if (existe && window.__splash.inserido === null) window.__splash.inserido = performance.now();
        if (!existe && window.__splash.inserido !== null && window.__splash.removido === null) window.__splash.removido = performance.now();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached", timeout: 5000 });
    const apareceu = Date.now();
    assert.equal(await splash.getAttribute("aria-hidden"), "true");
    assert.equal(await splash.evaluate((el) => getComputedStyle(el).pointerEvents), "auto");
    await splash.waitFor({ state: "detached", timeout: 3500 });
    assert.ok(Date.now() - apareceu <= 3000, `splash durou ${Date.now() - apareceu} ms`);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("pixel:splash-visto")), "1");
    const medido = await page.evaluate(() => window.__splash);
    assert.ok(medido.inserido !== null && medido.removido !== null, JSON.stringify(medido));
    assert.ok(medido.removido - medido.inserido >= 2000 && medido.removido - medido.inserido <= 3000, `durou ${medido.removido - medido.inserido} ms na página`);
    assert.equal(medido.animacaoFim, true, "a animação de saída não terminou");
    console.log("OK: a primeira entrada mostra o splash decorativo, por 2 a 3 s, recebendo cliques");

    // 2. Recarga na mesma aba: não aparece.
    await page.reload();
    await page.locator("main h1").waitFor();
    assert.equal(await splash.count(), 0);
    console.log("OK: recarregar na mesma aba não repete o splash");
    await context.close();
  }

  // 3. Clique durante a abertura pula, sem acionar o app.
  {
    const { context, page, splash } = await abrir();
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached" });
    const t0 = Date.now();
    await page.mouse.click(640, 450);
    await splash.waitFor({ state: "detached", timeout: 1000 });
    assert.ok(Date.now() - t0 <= 600, "o clique não acelerou a saída");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Nova tarefa" }).click();
    await page.getByRole("dialog", { name: "Nova tarefa" }).waitFor();
    console.log("OK: o clique durante a abertura pula, sem acionar o app");
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
    assert.equal(await page.evaluate(() => { try { return sessionStorage === undefined; } catch { return true; } }), true);
    await splash.waitFor({ state: "detached", timeout: 3500 });
    await page.locator("main h1").waitFor();
    console.log("OK: com sessionStorage bloqueado o splash aparece, some e não quebra");
    await context.close();
  }

  // 7. Tecla durante a abertura pula.
  {
    const { context, page, splash } = await abrir();
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached" });
    await page.keyboard.press("Escape");
    await splash.waitFor({ state: "detached", timeout: 1000 });
    console.log("OK: uma tecla durante a abertura pula");
    await context.close();
  }

  // 8. Suíte comum (sem opções) não vê a abertura.
  {
    const comum = await lancarNavegador();
    const context = await comum.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await page.locator("main h1").waitFor();
    assert.equal(await page.locator(".e-splash").count(), 0);
    await comum.close();
    console.log("OK: o navegador padrão das suítes não mostra a abertura");
  }

  // 6. Contraste e largura nos dois temas, em 320 px.
  for (const esquema of ["light", "dark"]) {
    const { context, page, splash } = await abrir({ viewport: { width: 320, height: 700 }, colorScheme: esquema });
    await page.goto(`${web}/quadro`, { waitUntil: "commit" });
    await splash.waitFor({ state: "attached", timeout: 5000 });
    await page.waitForFunction((escuro) => document.documentElement.classList.contains("dark") === escuro, esquema === "dark");
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
  console.log("8 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
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
