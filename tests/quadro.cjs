const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

const STATUS = ["a-fazer", "em-andamento", "em-revisao", "concluida"];
const COLUNAS = ["A fazer", "Em andamento", "Em revisão", "Concluída"];

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
  const temporario = await mkdtemp(join(tmpdir(), "pixel-quadro-"));
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(10000);
    const errosPagina = [];
    page.on("pageerror", (erro) => errosPagina.push(erro));

    const quadro = page.getByRole("region", { name: "Quadro de tarefas" });
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const menu = page.getByRole("navigation", { name: "Navegação principal" });
    const selecionar = async (nome, opcao) => {
      await page.getByRole("button", { name: new RegExp(nome) }).click();
      await page.getByRole("option", { name: opcao, exact: true }).click();
    };
    const tarefasApi = async () => (await fetch(`${api}/tarefas`)).json();
    // Cada cartão do quadro com a coluna em que foi desenhado.
    const cartoesQuadro = () => quadro.locator("article").evaluateAll((cartoes) => cartoes.map((cartao) => ({ id: cartao.dataset.taskId, coluna: cartao.closest("[data-status]").dataset.status })));
    const idsQuadro = async () => (await cartoesQuadro()).map((cartao) => cartao.id).sort();
    const idsLista = () => lista.locator("article").evaluateAll((cartoes) => cartoes.map((cartao) => cartao.dataset.taskId).sort());
    const semRolagemHorizontal = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const cenario = async (nome, passo) => { await passo(); cenarios.push(nome); };

    await cenario("acesso direto a /quadro com quatro colunas na ordem do contrato", async () => {
      await page.goto(`${web}/quadro`);
      await quadro.locator("article").first().waitFor();
      assert.deepEqual(await quadro.getByRole("heading", { level: 2 }).allInnerTexts(), COLUNAS);
      assert.deepEqual(await quadro.locator("[data-status]").evaluateAll((colunas) => colunas.map((coluna) => coluna.dataset.status)), STATUS);
      assert.equal(await page.getByRole("heading", { name: "Quadro de tarefas", level: 1 }).count(), 1);
    });

    await cenario("cada tarefa aparece uma vez, na coluna do seu status", async () => {
      const tarefas = await tarefasApi();
      const cartoes = await cartoesQuadro();
      assert.equal(cartoes.length, tarefas.length);
      assert.equal(new Set(cartoes.map((cartao) => cartao.id)).size, tarefas.length);
      for (const tarefa of tarefas) assert.equal(cartoes.find((cartao) => cartao.id === tarefa.id).coluna, tarefa.status);
      for (const status of STATUS) {
        const contador = await quadro.locator(`[data-status="${status}"] .e-board-count`).innerText();
        assert.equal(Number(contador), tarefas.filter((tarefa) => tarefa.status === status).length);
      }
      assert.match(await page.locator(".e-sheet-footer").innerText(), new RegExp(`^${tarefas.length} tarefas$`));
    });

    await cenario("colunas vazias continuam visíveis", async () => {
      await selecionar("Prioridade", "Baixa");
      assert.deepEqual(await cartoesQuadro(), [{ id: "5", coluna: "a-fazer" }]);
      assert.equal(await quadro.locator("[data-status]").count(), 4);
      assert.equal(await quadro.getByText("Nenhuma tarefa", { exact: true }).count(), 3);
      await selecionar("Prioridade", "Todas as prioridades");
    });

    await cenario("busca sem resultado mostra a mensagem", async () => {
      await busca.fill("sem correspondência");
      await page.getByText("Nenhuma tarefa encontrada.").waitFor();
      assert.equal(await page.locator("article").count(), 0);
      assert.match(await page.locator(".e-sheet-footer").innerText(), /^0 tarefas$/);
      await busca.fill("");
      await quadro.locator("article").first().waitFor();
    });

    await cenario("lista e quadro exibem os mesmos IDs em oito combinações de filtros", async () => {
      const combinacoes = [
        ["", "Todos os status", "Todas as prioridades"],
        ["tarefas", "Todos os status", "Todas as prioridades"],
        ["", "A fazer", "Todas as prioridades"],
        ["", "Todos os status", "Alta"],
        ["", "Em andamento", "Alta"],
        ["tela", "A fazer", "Média"],
        ["JSON", "Todos os status", "Todas as prioridades"],
        ["", "Concluída", "Baixa"],
      ];
      let vazias = 0;
      for (const [termo, status, prioridade] of combinacoes) {
        await busca.fill(termo);
        await selecionar("Status", status);
        await selecionar("Prioridade", prioridade);
        const vazio = page.getByText("Nenhuma tarefa encontrada.");
        await Promise.race([quadro.locator("article").first().waitFor(), vazio.waitFor()]);
        const noQuadro = await idsQuadro();
        await menu.getByRole("link", { name: "Tarefas" }).click();
        await Promise.race([lista.locator("article").first().waitFor(), vazio.waitFor()]);
        assert.equal(await busca.inputValue(), termo);
        assert.deepEqual(await idsLista(), noQuadro, `${termo} / ${status} / ${prioridade}`);
        if (noQuadro.length === 0) vazias++;
        await page.goBack();
        await page.waitForURL(/\/quadro$/);
        await Promise.race([quadro.locator("article").first().waitFor(), vazio.waitFor()]);
        assert.deepEqual(await idsQuadro(), noQuadro);
      }
      assert.equal(vazias, 1);
      await busca.fill("");
      await selecionar("Status", "Todos os status");
      await selecionar("Prioridade", "Todas as prioridades");
    });

    await cenario("a ficha aberta pelo quadro volta para o quadro", async () => {
      await busca.fill("json");
      const titulo = quadro.getByRole("link", { name: "Subir o json-server" });
      await titulo.click();
      await page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).waitFor();
      assert.equal(await quadro.count(), 1);
      await page.getByRole("button", { name: "Fechar detalhes da tarefa" }).click();
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      await page.waitForURL(/\/quadro$/);
      assert.equal(await busca.inputValue(), "json");
      assert.deepEqual(await idsQuadro(), ["2"]);
      await page.waitForFunction(() => document.activeElement?.textContent === "Subir o json-server");
      await busca.fill("");
    });

    await cenario("edição pelo cartão move a tarefa para a nova coluna", async () => {
      await quadro.locator("article").first().waitFor();
      await quadro.getByRole("button", { name: "Ações de Listar as tarefas na tela" }).click();
      await page.getByRole("menuitem", { name: "Editar tarefa", exact: true }).click();
      const dialogo = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
      await dialogo.waitFor();
      await dialogo.getByRole("button", { name: /Status/ }).click();
      await page.getByRole("option", { name: "Em revisão", exact: true }).click();
      await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      await page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      await page.waitForURL(/\/quadro$/);
      await quadro.locator('[data-status="em-revisao"] [data-task-id="4"]').waitFor();
      assert.equal((await cartoesQuadro()).filter((cartao) => cartao.id === "4").length, 1);
      assert.equal((await (await fetch(`${api}/tarefas/4`)).json()).status, "em-revisao");
    });

    await cenario("cartão do quadro omite o selo de status; lista e projeto mantêm", async () => {
      assert.equal(await quadro.locator(".e-status").count(), 0);
      assert.equal(await quadro.locator(".e-priority").count(), 5);
      await menu.getByRole("link", { name: "Tarefas" }).click();
      await lista.locator("article").first().waitFor();
      assert.equal(await lista.locator(".e-status").count(), 5);
      await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Gerenciador de Tarefas" }).click();
      const projeto = page.getByRole("region", { name: "Tarefas do projeto" });
      await projeto.locator("article").first().waitFor();
      assert.equal(await projeto.locator(".e-status").count(), 4);
    });

    await cenario("larguras de 1000 px e 375 px sem rolagem horizontal", async () => {
      await page.goto(`${web}/quadro`);
      await quadro.locator("article").first().waitFor();
      const posicoes = () => quadro.locator("[data-status]").evaluateAll((colunas) => colunas.map((coluna) => Math.round(coluna.getBoundingClientRect().x)));
      assert.equal(new Set(await posicoes()).size, 4);
      assert.equal(await semRolagemHorizontal(), true);
      await page.setViewportSize({ width: 1000, height: 800 });
      assert.equal(await semRolagemHorizontal(), true);
      await page.setViewportSize({ width: 375, height: 800 });
      assert.equal(new Set(await posicoes()).size, 1);
      assert.equal(await semRolagemHorizontal(), true);
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    await cenario("carregamento e falha da API", async () => {
      let liberar;
      const espera = new Promise((resolve) => { liberar = resolve; });
      await page.route(`${api}/tarefas`, async (rota) => { await espera; await rota.abort(); });
      await page.goto(`${web}/quadro`);
      await page.getByRole("status").filter({ hasText: "Carregando tarefas…" }).waitFor();
      liberar();
      await page.getByRole("alert").filter({ hasText: "As tarefas não carregaram" }).waitFor();
      assert.equal(await quadro.count(), 0);
      await page.unroute(`${api}/tarefas`);
    });

    await cenario("sem tarefas cadastradas mostra o estado vazio", async () => {
      await page.route(`${api}/tarefas`, (rota) => rota.fulfill({ json: [] }));
      await page.goto(`${web}/quadro`);
      await page.getByRole("heading", { name: "Espaço para o próximo passo" }).waitFor();
      assert.equal(await quadro.count(), 0);
      await page.unroute(`${api}/tarefas`);
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
