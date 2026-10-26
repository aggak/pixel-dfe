const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { comTextos, criarUi, lancarNavegador, TEXTO_STATUS } = require("./ui.cjs");

const ORDEM = ["a-fazer", "em-andamento", "em-revisao", "concluida"];

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

async function executar() {
  const temporario = await mkdtemp(join(tmpdir(), "pixel-quadro-"));
  const processos = [];
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  const evidencias = process.env.QUADRO_EVIDENCIAS;
  let browser;
  try {
    const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errosJs = [];
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    const ui = criarUi(page);
    const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const coluna = (status) => page.locator(`[data-status-column="${status}"]`);
    const idsDaColuna = (status) => coluna(status).locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const seletor = (nome) => page.getByRole("button", { name: new RegExp(nome) });
    const selecionar = async (nome, opcao) => {
      await seletor(nome).click();
      const item = page.getByRole("option", { name: opcao, exact: true });
      await item.click();
      await item.waitFor({ state: "detached" });
    };
    // A troca usa o controle Lista/Quadro da faixa de ações (#39), como a pessoa usuária faria.
    const irPara = (caminho) => page.getByRole("navigation", { name: "Visualização das tarefas" }).getByRole("link", { name: caminho === "/quadro" ? "Quadro" : "Lista", exact: true }).click();
    const lerBanco = async () => (await fetch(`${api}/tarefas`)).json();

    await page.goto(`${web}/quadro`);
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.deepEqual(await page.locator(".e-column-name").allInnerTexts(), ORDEM.map((status) => TEXTO_STATUS[status]));
    console.log("OK: /quadro abre com as quatro colunas na ordem do contrato");

    for (const status of ORDEM) {
      const esperadas = seed.tarefas.filter((t) => t.status === status);
      assert.deepEqual(await idsDaColuna(status), esperadas.map((t) => t.id));
      assert.equal(await coluna(status).locator("h2 > span:last-child").innerText(), String(esperadas.length));
      for (const tarefa of esperadas) assert.equal(await coluna(status).getByRole("link", { name: tarefa.titulo, exact: true }).count(), 1);
    }
    assert.match(await page.locator(".e-sheet-footer").innerText(), new RegExp(`^${seed.tarefas.length} tarefas$`));
    if (evidencias) await page.screenshot({ path: join(evidencias, "quadro-1280.png"), fullPage: true });
    console.log("OK: cada tarefa aparece uma vez na coluna do seu status, com contador");

    await selecionar("Status", "A fazer");
    for (const status of ORDEM.slice(1)) assert.equal(await coluna(status).getByText("Nenhuma tarefa", { exact: true }).count(), 1);
    assert.equal(await page.locator(".e-column").count(), 4);
    assert.deepEqual(await idsDaColuna("a-fazer"), seed.tarefas.filter((t) => t.status === "a-fazer").map((t) => t.id));
    console.log("OK: colunas vazias continuam visíveis com \"Nenhuma tarefa\"");

    // Estado único: o que o quadro filtrou chega à lista, e o que a lista filtra volta ao quadro.
    await busca.fill("diagrama");
    const doQuadro = await quadro.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    await irPara("/");
    await lista.getByRole("article").first().waitFor();
    assert.equal(await quadro.count(), 0);
    assert.equal(await busca.inputValue(), "diagrama");
    assert.match(await seletor("Status").innerText(), /A fazer/);
    assert.deepEqual(await lista.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId)), doQuadro);
    await busca.fill("");
    await selecionar("Status", "Todos os status");
    await selecionar("Prioridade", "Alta");
    const daLista = await lista.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    await irPara("/quadro");
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.match(await seletor("Prioridade").innerText(), /Alta/);
    assert.deepEqual((await quadro.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId))).sort(), [...daLista].sort());
    assert.deepEqual(daLista.sort(), seed.tarefas.filter((t) => t.prioridade === "alta").map((t) => t.id).sort());
    console.log("OK: lista e quadro leem o mesmo estado e mostram o mesmo conjunto");

    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada.").waitFor();
    assert.equal(await page.locator(".e-column").count(), 4);
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await coluna("a-fazer").locator("[data-task-id]").first().waitFor();
    assert.equal(await quadro.locator("[data-task-id]").count(), seed.tarefas.length);
    console.log("OK: busca sem resultado mantém as colunas e a limpeza restaura o quadro");

    // Detalhe e edição abrem na ficha sobre o quadro; a nova coluna vem do status gravado.
    const alvo = seed.tarefas.find((t) => t.status === "a-fazer");
    await coluna("a-fazer").getByRole("link", { name: alvo.titulo }).click();
    const detalhe = page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true });
    await detalhe.waitFor();
    assert.equal(await quadro.count(), 1);
    await detalhe.getByRole("button", { name: /^Fechar/ }).click();
    await detalhe.waitFor({ state: "detached" });
    // O dialog sai do DOM antes do history.back() terminar; espera a URL em vez de lê-la na hora.
    await page.waitForURL((url) => url.pathname === "/quadro");
    await coluna("a-fazer").getByRole("button", { name: `Ações de ${alvo.titulo}` }).click();
    await page.getByRole("menuitem", { name: "Editar tarefa" }).click();
    const edicao = page.getByRole("dialog", { name: "Editar tarefa", exact: true });
    await edicao.waitFor();
    await ui.escolher("Status", "Em revisão");
    await edicao.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await detalhe.waitFor();
    await coluna("em-revisao").locator(`[data-task-id="${alvo.id}"]`).waitFor();
    assert.equal(await coluna("a-fazer").locator(`[data-task-id="${alvo.id}"]`).count(), 0);
    assert.equal((await lerBanco()).find((t) => t.id === alvo.id).status, "em-revisao");
    await detalhe.getByRole("button", { name: /^Fechar/ }).click();
    await detalhe.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    console.log("OK: editar o status na ficha muda o cartão de coluna e mantém /quadro");

    await page.locator('[data-action="new-task"]').click();
    const nova = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
    await nova.waitFor();
    await nova.getByRole("button", { name: /^Fechar/ }).click();
    await nova.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    await page.locator('[data-action="new-task"]').click();
    await nova.waitFor();
    await ui.preencherTarefa(comTextos({ projetoId: "2", titulo: "Revisar o quadro por status", descricao: "Conferir colunas e cartões.", status: "concluida", prioridade: "baixa", responsavel: "Euclides", prazo: "2026-10-27" }, seed.projetos));
    await nova.getByRole("button", { name: "Salvar tarefa", exact: true }).click();
    await nova.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    await coluna("concluida").getByRole("link", { name: "Revisar o quadro por status" }).waitFor();
    assert.equal((await lerBanco()).length, seed.tarefas.length + 1);
    console.log("OK: nova tarefa criada no quadro volta para ele, na coluna do status");

    await page.reload();
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.equal(await quadro.locator("[data-task-id]").count(), seed.tarefas.length + 1);
    for (const [largura, colunas] of [[1280, 4], [800, 2], [320, 1]]) {
      await page.setViewportSize({ width: largura, height: 900 });
      const trilhas = await quadro.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      assert.equal(trilhas, colunas, `${largura} px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${largura} px`);
    }
    if (evidencias) await page.screenshot({ path: join(evidencias, "quadro-320.png"), fullPage: true });
    console.log("OK: acesso direto e recarga; 4, 2 e 1 colunas sem rolagem horizontal");

    assert.deepEqual(errosJs, []);
    const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
    assert.deepEqual(atuais, originais);
    console.log("8 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
  } finally {
    if (browser) await browser.close();
    for (const processo of processos) processo.kill();
    await rm(temporario, { recursive: true, force: true });
  }
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; });
