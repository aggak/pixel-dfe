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
  temporario = await mkdtemp(join(tmpdir(), "pixel-arrastar-"));
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
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
  const patches = [];
  page.on("request", (requisicao) => { if (requisicao.method() === "PATCH") patches.push({ url: requisicao.url(), corpo: requisicao.postDataJSON() }); });
  const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
  const coluna = (status) => page.locator(`[data-status-column="${status}"]`);
  const cartao = (id) => page.locator(`[data-task-id="${id}"]`);
  const anuncio = page.locator("main p[role=status]");
  const lerTarefa = async (id) => (await fetch(`${api}/tarefas/${id}`)).json();
  // O React Aria toma um toque exatamente no centro do elemento por leitor de tela (heurística do TalkBack) e cancela o arrasto nativo.
  // O Playwright aponta para o centro por padrão; uma pessoa nunca acerta o ponto exato, então o teste parte de um canto.
  const arrastar = (origem, destino) => origem.dragTo(destino, { sourcePosition: { x: 8, y: 8 } });
  const contar = async (status) => Number(await coluna(status).locator("h2 > span:last-child").innerText());

  // Dados de db.seed.json: tarefas 4 e 5 em "a-fazer" e 2 em "em-andamento".
  await page.goto(`${web}/quadro`);
  await quadro.locator("[data-task-id]").first().waitFor();

  // 1. Soltar em outra coluna grava só o status e move o cartão uma única vez.
  const [antesAFazer, antesAndamento] = [await contar("a-fazer"), await contar("em-andamento")];
  await arrastar(cartao("4"), coluna("em-andamento"));
  await coluna("em-andamento").locator('[data-task-id="4"]').waitFor();
  assert.equal(await page.locator('[data-task-id="4"]').count(), 1);
  assert.deepEqual([await contar("a-fazer"), await contar("em-andamento")], [antesAFazer - 1, antesAndamento + 1]);
  assert.deepEqual(patches.at(-1), { url: `${api}/tarefas/4`, corpo: { status: "em-andamento" } });
  assert.equal((await lerTarefa("4")).status, "em-andamento");
  assert.equal(await anuncio.innerText(), "Status de Listar as tarefas na tela alterado para Em andamento.");
  console.log("OK: soltar em outra coluna grava só o status e move o cartão uma única vez");

  // 2. Soltar na própria coluna não chama a API.
  const semPatch = page.waitForRequest((r) => r.method() === "PATCH", { timeout: 1500 }).then(() => "houve PATCH", () => "nenhum PATCH");
  await arrastar(cartao("4"), coluna("em-andamento"));
  assert.equal(await semPatch, "nenhum PATCH");
  console.log("OK: soltar na própria coluna não chama a API");

  // 3. Arrastar pelo título não navega nem abre a ficha.
  await arrastar(cartao("5").locator(".e-task-title"), coluna("em-revisao"));
  await coluna("em-revisao").locator('[data-task-id="5"]').waitFor();
  assert.equal(new URL(page.url()).pathname, "/quadro");
  assert.equal(await page.getByRole("dialog").count(), 0);
  console.log("OK: arrastar pelo título não navega nem abre a ficha");

  // 4. Falha da API: o cartão fica na origem e avisa.
  await page.route(`${api}/tarefas/2`, (r) => (r.request().method() === "PATCH" ? r.fulfill({ status: 500, body: "{}" }) : r.continue()));
  await arrastar(cartao("2"), coluna("concluida"));
  await cartao("2").getByRole("alert").waitFor();
  assert.match(await cartao("2").getByRole("alert").innerText(), /Não foi possível mudar o status/);
  assert.equal(await coluna("em-andamento").locator('[data-task-id="2"]').count(), 1);
  assert.equal((await lerTarefa("2")).status, "em-andamento");
  await page.unroute(`${api}/tarefas/2`);
  console.log("OK: falha da API deixa o cartão na origem e mostra o alerta");

  // 5. Lista e projeto não têm cartões arrastáveis.
  for (const rota of ["/", "/projetos/1"]) {
    await page.goto(`${web}${rota}`);
    await page.locator("[data-task-id]").first().waitFor();
    assert.equal(await page.locator('[data-task-id][draggable="true"]').count(), 0, rota);
  }
  console.log("OK: lista e projeto não têm cartões arrastáveis");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("5 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
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
