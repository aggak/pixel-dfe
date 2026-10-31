// Estados de carregamento da issue #43 com requisições controladas no navegador.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const processos = [];
let browser;
let temporario;

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function esperar(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processos.some((processo) => processo.exitCode !== null)) throw new Error("Servidor encerrou antes do teste.");
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(arquivo, argumentos, env = process.env) {
  const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], {
    cwd: raiz, env, windowsHide: true, stdio: "pipe",
  });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (dado) => process.stderr.write(dado));
  processos.push(processo);
}

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  temporario = await mkdtemp(join(tmpdir(), "pixel-carregamento-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([esperar(`${api}/tarefas`), esperar(web)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));

  async function conferirRota(nome, caminho, selecionarRequisicao, selecionarIndicador) {
    let iniciou;
    let liberar;
    const requisicao = new Promise((resolve) => { iniciou = resolve; });
    const bloqueio = new Promise((resolve) => { liberar = resolve; });
    const interceptar = async (rota) => {
      if (rota.request().method() === "GET" && selecionarRequisicao(new URL(rota.request().url()))) {
        iniciou();
        await bloqueio;
      }
      await rota.continue();
    };
    await page.route(`${api}/**`, interceptar);
    try {
      await page.goto(`${web}${caminho}`);
      await requisicao;
      const indicador = selecionarIndicador();
      await indicador.waitFor();
      assert.equal(await indicador.isVisible(), true, `${nome}: indicador oculto`);
      liberar();
      await indicador.waitFor({ state: "detached" });
      console.log(`OK: ${nome}`);
    } finally {
      liberar();
      await page.unroute(`${api}/**`, interceptar);
    }
  }

  const status = (texto) => page.getByRole("status").filter({ hasText: texto });
  const statusFicha = (texto) => page.getByRole("dialog").getByRole("status").filter({ hasText: texto });
  await conferirRota("lista mostra e retira carregamento das tarefas", "/", (url) => url.pathname === "/tarefas", () => status("Carregando tarefas"));
  await conferirRota("quadro mostra e retira carregamento das tarefas", "/quadro", (url) => url.pathname === "/tarefas", () => status("Carregando tarefas"));
  await conferirRota("lista mostra e retira carregamento dos projetos nas abas", "/", (url) => url.pathname === "/projetos", () => page.getByRole("navigation", { name: "Projetos" }).getByRole("status"));
  await conferirRota("lista de projetos mostra e retira carregamento", "/projetos", (url) => url.pathname === "/projetos", () => status("Carregando projetos"));
  await conferirRota("página do projeto mostra e retira carregamento", "/projetos/1", (url) => url.pathname === "/projetos/1", () => status("Carregando projeto"));
  await conferirRota("detalhes da tarefa mostram e retiram carregamento", "/tarefas/1", (url) => url.pathname === "/tarefas/1", () => statusFicha("Carregando tarefa"));
  await conferirRota("nome do projeto na ficha mostra e retira carregamento", "/tarefas/1", (url) => url.pathname === "/projetos", () => page.getByRole("dialog").locator(".e-read-project [role=status]"));
  await conferirRota("edição da tarefa mostra e retira carregamento", "/tarefas/1/editar", (url) => url.pathname === "/tarefas/1", () => statusFicha("Carregando tarefa"));
  await conferirRota("nova tarefa mostra e retira carregamento dos projetos", "/tarefas/nova", (url) => url.pathname === "/projetos", () => statusFicha("Carregando projetos"));
  await conferirRota("edição do projeto mostra e retira carregamento", "/projetos/1/editar", (url) => url.pathname === "/projetos/1", () => statusFicha("Carregando projeto"));

  await page.route(`${api}/projetos`, (rota) => rota.fulfill({ status: 500, body: "{}" }));
  await page.goto(`${web}/projetos`);
  await page.getByRole("alert").waitFor();
  assert.equal(await status("Carregando projetos").count(), 0);
  await page.unroute(`${api}/projetos`);
  console.log("OK: erro da API retira o indicador e mostra a mensagem de falha");

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  console.log("OK: sem erros JavaScript e bancos locais preservados");
}

executar()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close().catch(() => {});
    for (const processo of processos) {
      if (processo.exitCode === null) {
        const encerrado = new Promise((resolve) => processo.once("exit", resolve));
        processo.kill();
        await encerrado;
      }
    }
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
