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

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-ficha-"));
  const originais = await Promise.all(["db.json", "db.seed.json"].map((arquivo) => readFile(arquivo, "utf8")));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar(processos, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);

  const overlay = page.locator(".e-form-overlay");
  const filtro = () => overlay.evaluate((el) => getComputedStyle(el).backdropFilter);
  // A transição de 0,2 s deixa o valor calculado em trânsito por instantes: espera assentar.
  const filtroFinal = async (esperado) => {
    await page.waitForFunction(([seletor, valor]) => getComputedStyle(document.querySelector(seletor)).backdropFilter === valor, [".e-form-overlay", esperado]);
    assert.equal(await filtro(), esperado);
  };

  // Desfoque só na edição: detalhes, nova tarefa e novo projeto ficam sem filtro.
  await page.goto(`${web}/quadro`);
  await page.locator("[data-task-id]").first().waitFor();
  await page.locator('[data-task-id="1"] .e-task-title').click();
  await page.getByRole("dialog", { name: "Detalhes da tarefa" }).waitFor();
  await filtroFinal("none");
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
  await page.getByRole("dialog", { name: "Editar tarefa" }).waitFor();
  await filtroFinal("blur(3px)");
  await page.goto(`${web}/tarefas/nova`);
  await page.getByRole("dialog", { name: "Nova tarefa" }).waitFor();
  await filtroFinal("none");
  await page.goto(`${web}/projetos/novo`);
  await page.getByRole("dialog", { name: "Novo projeto" }).waitFor();
  await filtroFinal("none");
  console.log("OK: o fundo só é desfocado na edição");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("1 cenário aprovado; nenhum erro JavaScript não tratado e bancos preservados.");
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
