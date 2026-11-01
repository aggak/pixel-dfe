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
  temporario = await mkdtemp(join(tmpdir(), "pixel-erro-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await esperar(web);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const alerta = (texto) => page.getByRole("alert").filter({ hasText: texto });
  const tentar = () => page.getByRole("main").getByRole("button", { name: "Tentar de novo" });

  await page.goto(`${web}/`);
  await alerta("Não foi possível carregar as tarefas").waitFor();
  assert.equal(await tentar().count(), 1);
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  await esperar(`${api}/tarefas`);
  await tentar().click();
  await page.locator("[data-task-id]").first().waitFor();
  await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Gerenciador de Tarefas" }).waitFor();
  assert.equal(await alerta("Não foi possível carregar").count(), 0);
  assert.equal(await page.locator(".e-task-project").first().isVisible(), true);
  console.log("OK: lista com json-server parado avisa e carrega ao tentar de novo");

  async function conferirRota(nome, caminho, texto, carregado, escopo = () => page.getByRole("main"), comAbas = false) {
    let falhar = true;
    const interceptar = (rota) => (falhar ? rota.abort() : rota.continue());
    await page.route(`${api}/**`, interceptar);
    try {
      await page.goto(`${web}${caminho}`);
      await escopo().getByRole("alert").filter({ hasText: texto }).waitFor();
      if (comAbas) assert.equal(await abas().getByRole("button").count(), 0, `${nome}: abas repetem o aviso`);
      falhar = false;
      await escopo().getByRole("button", { name: "Tentar de novo" }).first().click();
      await carregado().waitFor();
      if (comAbas) await abas().getByRole("link", { name: "Gerenciador de Tarefas" }).waitFor();
      assert.equal(await escopo().getByRole("alert").filter({ hasText: texto }).count(), 0, `${nome}: erro continua visível`);
      console.log(`OK: ${nome}`);
    } finally {
      await page.unroute(`${api}/**`, interceptar);
    }
  }

  const ficha = () => page.getByRole("dialog");
  const abas = () => page.getByRole("navigation", { name: "Projetos" });
  await conferirRota("quadro avisa e carrega ao tentar de novo", "/quadro", "Não foi possível carregar as tarefas", () => page.locator("[data-status-column] [data-task-id]").first(), undefined, true);
  await conferirRota("lista de projetos avisa e carrega ao tentar de novo", "/projetos", "Não foi possível carregar os projetos", () => page.locator("[data-project-id]").first());
  await conferirRota("página do projeto avisa e carrega ao tentar de novo", "/projetos/1", "Não foi possível carregar o projeto", () => page.locator("[data-task-id]").first(), undefined, true);
  await conferirRota("detalhes da tarefa avisam e carregam ao tentar de novo", "/tarefas/1", "Não foi possível carregar a tarefa", () => ficha().locator(".e-read-title"), ficha);
  await conferirRota("edição da tarefa avisa e carrega ao tentar de novo", "/tarefas/1/editar", "Não foi possível carregar a tarefa", () => ficha().locator("form"), ficha);
  await conferirRota("edição do projeto avisa e carrega ao tentar de novo", "/projetos/1/editar", "Não foi possível carregar o projeto", () => ficha().locator("form"), ficha);

  let falharProjetos = true;
  const interceptarProjetos = (rota) => (falharProjetos ? rota.abort() : rota.continue());
  await page.route(`${api}/projetos`, interceptarProjetos);
  await page.goto(`${web}/tarefas/nova`);
  await alerta("Não foi possível carregar os projetos").waitFor();
  falharProjetos = false;
  await ficha().getByRole("button", { name: "Tentar de novo" }).click();
  await alerta("Não foi possível carregar os projetos").waitFor({ state: "detached" });
  assert.equal(await ficha().getByRole("button", { name: "Tentar de novo" }).count(), 0);
  await page.unroute(`${api}/projetos`, interceptarProjetos);
  console.log("OK: formulário avisa e recarrega os projetos ao tentar de novo");

  const tentarAbas = () => abas().getByRole("button", { name: "Tentar de novo" });
  let falharAbas = true;
  const interceptarAbas = (rota) => (falharAbas ? rota.abort() : rota.continue());
  await page.route(`${api}/projetos`, interceptarAbas);
  await page.goto(`${web}/`);
  await page.locator("[data-task-id]").first().waitFor();
  await abas().getByRole("status").filter({ hasText: "Os projetos não carregaram." }).waitFor();
  await tentarAbas().focus();
  await page.keyboard.press("Enter");
  await abas().getByRole("status").filter({ hasText: "Os projetos não carregaram." }).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === "Tentar de novo" && !document.activeElement.disabled);
  assert.equal(await page.locator(".e-task-project").count(), 0);
  falharAbas = false;
  await tentarAbas().click();
  await abas().getByRole("link", { name: "Gerenciador de Tarefas" }).waitFor();
  await page.locator(".e-task-project").first().waitFor();
  assert.equal(await tentarAbas().count(), 0);
  await page.unroute(`${api}/projetos`, interceptarAbas);
  console.log("OK: abas avisam a falha, recarregam projetos e nomes nos cartões mantendo o foco");

  await page.route(`${api}/**`, (rota) => rota.abort());
  await page.goto(`${web}/`);
  await alerta("Não foi possível carregar as tarefas").waitFor();
  assert.equal(await tentarAbas().count(), 0);
  await page.unrouteAll();
  console.log("OK: com a API parada só o aviso principal aparece");

  const interceptarFichaFoco = (rota) => rota.abort();
  await page.route(`${api}/**`, interceptarFichaFoco);
  await page.goto(`${web}/tarefas/1`);
  await alerta("Não foi possível carregar a tarefa").waitFor();
  await ficha().getByRole("button", { name: "Tentar de novo" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Tentar de novo");
  assert.equal(await ficha().count(), 1);
  await page.unroute(`${api}/**`, interceptarFichaFoco);
  console.log("OK: na ficha a nova falha mantém o foco em tentar de novo");

  let falharNome = true;
  const interceptarNome = (rota) => (falharNome ? rota.abort() : rota.continue());
  await page.route(`${api}/projetos`, interceptarNome);
  await page.goto(`${web}/tarefas/1`);
  await ficha().locator(".e-read-title").waitFor();
  await ficha().getByRole("status").filter({ hasText: "Nome do projeto indisponível." }).waitFor();
  falharNome = false;
  await ficha().getByRole("button", { name: "Tentar de novo" }).click();
  await ficha().locator(".e-read-project").getByRole("link", { name: "Gerenciador de Tarefas" }).waitFor();
  assert.equal(await ficha().getByText("Nome do projeto indisponível.").count(), 0);
  await page.unroute(`${api}/projetos`, interceptarNome);
  console.log("OK: ficha avisa quando só o nome do projeto falha e recarrega");

  const interceptarTudo = (rota) => rota.abort();
  await page.route(`${api}/**`, interceptarTudo);
  await page.goto(`${web}/projetos`);
  await alerta("Não foi possível carregar os projetos").waitFor();
  await tentar().focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.textContent === "Tentar de novo");
  await page.unroute(`${api}/**`, interceptarTudo);
  console.log("OK: nova falha devolve o foco para tentar de novo");

  let falharFicha = true;
  const interceptarFicha = (rota) => (falharFicha ? rota.abort() : rota.continue());
  await page.route(`${api}/**`, interceptarFicha);
  await page.goto(`${web}/tarefas/1`);
  await alerta("Não foi possível carregar a tarefa").waitFor();
  falharFicha = false;
  await ficha().getByRole("button", { name: "Tentar de novo" }).click();
  await ficha().locator(".e-read-project").getByRole("link", { name: "Gerenciador de Tarefas" }).waitFor();
  await page.unroute(`${api}/**`, interceptarFicha);
  console.log("OK: ficha recarrega também o nome do projeto");

  let liberarLenta;
  let lenta = false;
  const interceptarLenta = async (rota) => {
    if (!lenta) return rota.abort();
    await new Promise((resolve) => { liberarLenta = resolve; });
    await rota.continue();
  };
  await page.route(`${api}/projetos`, interceptarLenta);
  await page.goto(`${web}/projetos`);
  await alerta("Não foi possível carregar os projetos").waitFor();
  lenta = true;
  await tentar().click();
  await page.locator("main [data-pending]").waitFor();
  assert.equal(await alerta("Não foi possível carregar os projetos").count(), 1);
  await alerta("Tentando de novo…").waitFor();
  assert.equal(await page.getByRole("main").getByRole("status").count(), 0);
  while (!liberarLenta) await new Promise((resolve) => setTimeout(resolve, 20));
  liberarLenta();
  await page.locator("[data-project-id]").first().waitFor();
  await page.unroute(`${api}/projetos`, interceptarLenta);
  console.log("OK: durante a nova tentativa o aviso fica e o botão indica carregamento");

  await page.goto(`${web}/projetos/999`);
  await alerta("Projeto não encontrado").waitFor();
  assert.equal(await tentar().count(), 0);
  console.log("OK: projeto inexistente não oferece tentar de novo");

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
