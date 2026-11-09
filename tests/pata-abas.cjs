const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

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

const contador = () => {
  window.__patas = 0;
  const conta = (no) => { if (no.nodeType === 1 && (no.matches(".e-pata") || no.querySelector(".e-pata"))) window.__patas++; };
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(conta))).observe(document, { childList: true, subtree: true });
};

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-pata-"));
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
  const novaPagina = async (opcoes = {}) => {
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opcoes });
    const page = await contexto.newPage();
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    await page.addInitScript(contador);
    return page;
  };
  const page = await novaPagina();
  const ativa = page.locator('.e-tabs a[aria-current="page"]');
  const pata = page.locator(".e-tabs .e-pata");
  const patas = () => page.evaluate(() => window.__patas);
  const aba = (nome) => page.locator(".e-tabs").getByRole("link", { name: nome, exact: true });
  const ate = (url) => page.waitForURL((u) => u.pathname === url);
  const fim = async () => { await pata.first().waitFor({ state: "detached", timeout: 2000 }); };

  // 1. Primeira carga em "/": nenhuma pata.
  await page.goto(`${web}/`); await page.locator("main h1").waitFor(); await page.waitForTimeout(800);
  assert.equal(await patas(), 0);
  assert.equal(await pata.count(), 0);

  // 2. "Todas" -> projeto: a pata aparece na aba nova e some.
  await aba("Gerenciador de Tarefas").click();
  await pata.waitFor({ state: "attached" });
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.notEqual(await ativa.getAttribute("data-puxada"), null);
  assert.equal(await pata.getAttribute("aria-hidden"), "true");
  assert.equal(await pata.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
  assert.equal(await ativa.getAttribute("aria-current"), "page");
  await aba("Gerenciador de Tarefas").waitFor();
  await fim();
  assert.equal(await ativa.getAttribute("data-puxada"), null);
  assert.equal(await patas(), 1);

  // 3. Projeto -> projeto (mesma página): anima de novo, na aba nova.
  await aba("Modelagem da Biblioteca").click();
  await pata.waitFor({ state: "attached" });
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.equal(await ativa.textContent(), "Modelagem da Biblioteca");
  assert.equal(await patas(), 2);
  await fim();

  // 4. Clique em outra aba durante a animação: navega, e no fim há no máximo uma pata, na aba ativa.
  await aba("Gerenciador de Tarefas").click();
  await pata.waitFor({ state: "attached" });
  await aba("Modelagem da Biblioteca").click();
  await ate("/projetos/2");
  await pata.waitFor({ state: "attached" });
  assert.ok((await pata.count()) <= 1);
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.equal(await ativa.textContent(), "Modelagem da Biblioteca");
  await fim();
  assert.equal(await page.locator(".e-pata").count(), 0);
  assert.equal(await page.locator("[data-puxada]").count(), 0);

  // 5. Lista <-> Quadro em "/": nenhuma pata nova.
  await aba("Todas").click();
  await ate("/");
  await fim();
  const antes = await patas();
  await page.getByRole("link", { name: "Quadro", exact: true }).click();
  await ate("/quadro");
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: "Lista", exact: true }).click();
  await ate("/");
  await page.waitForTimeout(800);
  assert.equal(await patas(), antes);
  assert.equal(await page.locator(".e-pata").count(), 0);

  // 6. Movimento reduzido: nada.
  const reduzida = await novaPagina({ reducedMotion: "reduce" });
  await reduzida.goto(`${web}/`); await reduzida.locator("main h1").waitFor();
  await reduzida.locator(".e-tabs").getByRole("link", { name: "Gerenciador de Tarefas", exact: true }).click();
  await reduzida.waitForURL((u) => u.pathname === "/projetos/1");
  await reduzida.waitForTimeout(900);
  assert.equal(await reduzida.evaluate(() => window.__patas), 0);

  // 7. Tema escuro: a pata usa as cores escuras e se distingue da aba.
  const escura = await novaPagina({ colorScheme: "dark" });
  await escura.goto(`${web}/`); await escura.locator("main h1").waitFor();
  await escura.locator(".e-tabs").getByRole("link", { name: "Gerenciador de Tarefas", exact: true }).click();
  await escura.locator(".e-tabs .e-pata").waitFor({ state: "attached" });
  const cores = await escura.evaluate(() => ({
    corpo: getComputedStyle(document.querySelector(".e-pata .e-gato-corpo")).fill,
    aba: getComputedStyle(document.querySelector('.e-tabs a[aria-current="page"]')).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue("--e-gato-corpo").trim(),
  }));
  assert.equal(cores.token, "#bb91ca");
  assert.notEqual(cores.corpo, cores.aba);

  assert.deepEqual(errosJs, []);
  const finais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(finais, originais);
  console.log("7 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
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
