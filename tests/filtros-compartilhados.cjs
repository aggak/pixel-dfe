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
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

async function executar() {
  const temporario = await mkdtemp(join(tmpdir(), "pixel-filtros-"));
  const processos = [];
  const cenarios = [];
  let browser;
  try {
    const original = await readFile("db.json", "utf8");
    await copyFile("db.seed.json", join(temporario, "db.json"));
    const portaApi = await portaLivre();
    const portaWeb = await portaLivre();
    const api = `http://127.0.0.1:${portaApi}`;
    const web = `http://127.0.0.1:${portaWeb}`;
    processos.push(spawn(process.execPath, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)], { windowsHide: true, stdio: "pipe" }));
    processos.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: api } }));
    for (const processo of processos) processo.stderr.on("data", (erro) => process.stderr.write(erro));
    await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

    browser = await lancarNavegador();
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errosPagina = [];
    page.on("pageerror", (erro) => errosPagina.push(erro));

    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const menu = page.getByRole("navigation", { name: "Navegação principal" });
    const abas = page.getByRole("navigation", { name: "Projetos" });
    const seletor = (nome) => page.getByRole("button", { name: new RegExp(nome) });
    const selecionar = async (nome, opcao) => {
      await seletor(nome).click();
      await page.getByRole("option", { name: opcao, exact: true }).click();
    };
    const idsLista = async () => {
      await lista.getByRole("article").first().waitFor();
      return lista.locator("article").evaluateAll((cartoes) => cartoes.map((cartao) => cartao.dataset.taskId).sort());
    };
    // Estado visível dos três controles e das tarefas exibidas na lista.
    const estado = async () => ({
      busca: await busca.inputValue(),
      status: (await seletor("Status").innerText()).includes("A fazer"),
      prioridade: (await seletor("Prioridade").innerText()).includes("Média"),
      ids: await idsLista(),
    });
    const esperado = { busca: "tarefas", status: true, prioridade: true, ids: ["4"] };
    const cenario = async (nome, passo) => { await passo(); cenarios.push(nome); };

    await page.goto(web);
    await lista.getByRole("article").first().waitFor();
    await busca.fill("tarefas");
    await selecionar("Status", "A fazer");
    await selecionar("Prioridade", "Média");
    assert.deepEqual(await estado(), esperado);

    await cenario("menu: Projetos e volta para Tarefas", async () => {
      await menu.getByRole("link", { name: "Projetos" }).click();
      await page.getByRole("heading", { name: "Projetos", level: 1 }).waitFor();
      await menu.getByRole("link", { name: "Tarefas" }).click();
      assert.deepEqual(await estado(), esperado);
    });

    await cenario("abas de projeto e Todas", async () => {
      await abas.getByRole("link", { name: "Gerenciador de Tarefas" }).click();
      await page.getByRole("region", { name: "Tarefas do projeto" }).getByRole("article").first().waitFor();
      await abas.getByRole("link", { name: "Todas" }).click();
      assert.deepEqual(await estado(), esperado);
    });

    await cenario("botão Voltar do navegador", async () => {
      await abas.getByRole("link", { name: "Modelagem da Biblioteca" }).click();
      await page.getByRole("region", { name: "Tarefas do projeto" }).getByRole("article").first().waitFor();
      await page.goBack();
      assert.deepEqual(await estado(), esperado);
    });

    await cenario("abrir e fechar a ficha da tarefa", async () => {
      await lista.getByRole("link", { name: "Listar as tarefas na tela" }).click();
      await page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      assert.deepEqual(await estado(), esperado);
    });

    await cenario("edição recarrega os dados e mantém os filtros", async () => {
      await lista.getByRole("link", { name: "Listar as tarefas na tela" }).click();
      await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
      const dialogo = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
      await dialogo.waitFor();
      await dialogo.getByLabel(/^Título\s*\*?$/).fill("Listar as tarefas na tela principal");
      await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).getByText("Listar as tarefas na tela principal").waitFor();
      await page.keyboard.press("Escape");
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      await lista.getByRole("link", { name: "Listar as tarefas na tela principal" }).waitFor();
      assert.deepEqual(await estado(), esperado);
      const gravada = await (await fetch(`${api}/tarefas/4`)).json();
      assert.equal(gravada.titulo, "Listar as tarefas na tela principal");
    });

    await cenario("limpar os controles volta a todas as tarefas", async () => {
      await busca.fill("");
      await selecionar("Status", "Todos os status");
      await selecionar("Prioridade", "Todas as prioridades");
      assert.deepEqual(await idsLista(), ["1", "2", "3", "4", "5"]);
      await menu.getByRole("link", { name: "Projetos" }).click();
      await menu.getByRole("link", { name: "Tarefas" }).click();
      assert.equal(await busca.inputValue(), "");
      assert.deepEqual(await idsLista(), ["1", "2", "3", "4", "5"]);
    });

    await cenario("recarregar a página parte das opções gerais", async () => {
      await busca.fill("json");
      await page.reload();
      assert.equal(await busca.inputValue(), "");
      assert.deepEqual(await idsLista(), ["1", "2", "3", "4", "5"]);
    });

    assert.deepEqual(errosPagina, []);
    assert.equal(await readFile("db.json", "utf8"), original);
    for (const nome of cenarios) console.log(`OK: ${nome}`);
    console.log(`${cenarios.length} cenários aprovados`);
  } finally {
    if (browser) await browser.close();
    for (const processo of processos) processo.kill();
    await rm(temporario, { recursive: true, force: true });
  }
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; });
