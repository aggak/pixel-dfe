// Suíte da página Nova tarefa em navegador real.
// Sobe a aplicação real (Vite) e o json-server com cópia temporária de db.seed.json; os bancos reais nunca são alterados.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdir, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer: servidorNet } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
let chromium;
try { ({ chromium } = require("playwright")); } catch { chromium = null; }
const repo = join(__dirname, "..");
const evidencias = process.env.NOVA_TAREFA_EVIDENCIAS || "";
const ROTULOS = ["Projeto", "Título", "Descrição", "Status", "Prioridade", "Responsável", "Prazo"];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let browser;
let processoApi;
let processoWeb;
let dadosTemp;
let apiUrl = "";
let origem = "";
async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}
async function ate(descricao, verificar, tentativas = 150) {
  for (let i = 0; i < tentativas; i++) {
    try { const valor = await verificar(); if (valor) return valor; } catch {}
    await dormir(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${descricao}`);
}
async function portaLivre() {
  const servidor = servidorNet();
  await new Promise((resolve, reject) => { servidor.once("error", reject); servidor.listen(0, "127.0.0.1", resolve); });
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}
async function encerrar(processo) {
  if (processo && processo.exitCode === null) {
    const fim = new Promise((resolve) => processo.once("exit", resolve));
    processo.kill();
    await fim;
  }
}
async function executar() {
  if (!chromium) throw new Error("Pacote 'playwright' não encontrado. Execute com NODE_PATH apontando para o pacote de testes.");
  const bancoRealAntes = await readFile(join(repo, "db.json"), "utf8");
  const seedAntes = await readFile(join(repo, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedAntes);
  dadosTemp = await mkdtemp(join(tmpdir(), "pixel-nova-tarefa-"));
  const caminhoDb = join(dadosTemp, "db.json");
  await copyFile(join(repo, "db.seed.json"), caminhoDb);
  const portaApi = await portaLivre();
  const portaWeb = await portaLivre();
  apiUrl = `http://127.0.0.1:${portaApi}`;
  origem = `http://127.0.0.1:${portaWeb}`;
  processoApi = spawn(process.execPath, [join(repo, "node_modules/json-server/lib/bin.js"), caminhoDb, "--host", "127.0.0.1", "--port", String(portaApi)], { cwd: repo, windowsHide: true, stdio: "pipe" });
  processoWeb = spawn(process.execPath, [join(repo, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { cwd: repo, windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: apiUrl } });
  for (const processo of [processoApi, processoWeb]) {
    processo.stdout.on("data", () => {});
    processo.stderr.on("data", (dado) => process.stderr.write(dado));
  }
  await ate("API temporária", async () => processoApi.exitCode === null && (await fetch(`${apiUrl}/projetos`)).ok);
  await ate("aplicação real", async () => processoWeb.exitCode === null && (await fetch(origem)).ok);
  try { browser = await chromium.launch({ channel: "chrome", headless: true }); }
  catch (erro) { throw new Error(`Não foi possível abrir o Chrome (channel "chrome"): ${erro.message}`); }
  const page = await browser.newPage();
  const errosPagina = [];
  const errosConsole = [];
  const requisicoesApi = [];
  const posts = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) errosConsole.push(msg.text()); });
  page.on("request", (req) => {
    if (req.url().startsWith(apiUrl)) requisicoesApi.push(`${req.method()} ${new URL(req.url()).pathname}`);
    if (req.method() === "POST" && req.url() === `${apiUrl}/tarefas`) { try { posts.push(JSON.parse(req.postData() || "{}")); } catch { posts.push({}); } }
  });
  const campo = (nome) => page.getByLabel(nome, { exact: true });
  const botaoSalvar = () => page.getByRole("button", { name: "Salvar tarefa", exact: true });
  const botaoEnvio = () => page.locator('form button[type="submit"]');
  const caminho = () => new URL(page.url());
  const lerDb = async () => JSON.parse(await readFile(caminhoDb, "utf8"));
  async function abrir(rota) {
    await page.goto(`${origem}${rota}`);
    await page.locator("form").waitFor();
    await ate("projetos carregados no formulário", async () => (await campo("Projeto").evaluate((el) => el.options.length)) >= seed.projetos.length + 1);
  }
  async function preencher(dados) {
    if (dados.projetoId) await campo("Projeto").selectOption(dados.projetoId);
    await campo("Título").fill(dados.titulo);
    await campo("Descrição").fill(dados.descricao);
    await campo("Status").selectOption(dados.status);
    await campo("Prioridade").selectOption(dados.prioridade);
    await campo("Responsável").fill(dados.responsavel);
    await campo("Prazo").fill(dados.prazo);
  }
  const base = { projetoId: "1", titulo: "Tarefa da suíte nova tarefa", descricao: "Criada pela suíte da página nova", status: "em-andamento", prioridade: "alta", responsavel: "Bruno", prazo: "2027-03-15" };
  await conferir("abertura direta e recarga em /tarefas/nova sem GET /tarefas/nova na API", async () => {
    requisicoesApi.length = 0; await abrir("/tarefas/nova");
    assert.equal(await page.getByRole("heading", { name: "Nova tarefa", exact: true }).count(), 1);
    for (const rotulo of ROTULOS) assert.equal(await campo(rotulo).count(), 1, rotulo);
    assert.equal(await campo("Projeto").inputValue(), ""); assert.equal(await botaoSalvar().count(), 1);
    await page.reload(); await page.locator("form").waitFor();
    await ate("projetos após recarga", async () => (await campo("Projeto").evaluate((el) => el.options.length)) >= seed.projetos.length + 1);
    assert.equal(await page.getByRole("heading", { name: "Nova tarefa", exact: true }).count(), 1);
    assert.ok(!requisicoesApi.some((linha) => linha.includes("/tarefas/nova")), requisicoesApi.join(","));
    if (evidencias) { await mkdir(evidencias, { recursive: true }); await page.screenshot({ path: join(evidencias, "nova-tarefa.png"), fullPage: true }); }
  });
  await conferir("/tarefas/1 continua sendo o detalhe da tarefa", async () => {
    await page.goto(`${origem}/tarefas/1`);
    await page.getByRole("heading", { name: "Detalhes da tarefa", exact: true }).waitFor();
    await page.getByRole("link", { name: seed.tarefas[0].titulo, exact: true }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
  });
  await conferir("link Nova tarefa na lista abre o cadastro sem projeto preselecionado", async () => {
    await page.goto(`${origem}/`); await page.getByRole("link", { name: seed.tarefas[0].titulo, exact: true }).waitFor();
    await page.getByRole("link", { name: "Nova tarefa", exact: true }).click(); await page.locator("form").waitFor();
    assert.equal(caminho().pathname, "/tarefas/nova"); assert.equal(caminho().search, "");
    await ate("projetos carregados", async () => (await campo("Projeto").evaluate((el) => el.options.length)) >= seed.projetos.length + 1);
    assert.equal(await campo("Projeto").inputValue(), "");
  });
  await conferir("links nos projetos 1 e 2 preselecionam o projeto de origem", async () => {
    for (const projeto of seed.projetos) {
      await page.goto(`${origem}/projetos/${projeto.id}`); await page.getByRole("heading", { name: projeto.nome, exact: true }).waitFor();
      const link = page.getByRole("link", { name: "Nova tarefa", exact: true });
      assert.equal(await link.getAttribute("href"), `/tarefas/nova?projetoId=${encodeURIComponent(String(projeto.id))}`);
      await link.click(); await page.locator("form").waitFor();
      await ate(`projeto ${projeto.id} preselecionado`, async () => (await campo("Projeto").inputValue()) === String(projeto.id));
      assert.equal(caminho().searchParams.get("projetoId"), String(projeto.id));
    }
  });
  await conferir("mudança da query na mesma página atualiza o contexto", async () => {
    await abrir("/tarefas/nova?projetoId=1"); assert.equal(await campo("Projeto").inputValue(), "1");
    await page.evaluate(() => { history.pushState({}, "", "/tarefas/nova?projetoId=2"); dispatchEvent(new PopStateEvent("popstate")); });
    await ate("contexto trocado para o projeto 2", async () => (await campo("Projeto").inputValue()) === "2");
    assert.equal(await page.getByRole("link", { name: "Voltar para o projeto", exact: true }).getAttribute("href"), "/projetos/2");
  });
  await conferir("POST real sem id persiste no arquivo e volta para a lista", async () => {
    const dados = { ...base, titulo: "Tarefa persistida pela suíte" }; posts.length = 0;
    await abrir("/tarefas/nova"); await preencher(dados); await botaoSalvar().click();
    await ate("retorno à lista após criar", async () => caminho().pathname === "/");
    await page.getByRole("link", { name: dados.titulo, exact: true }).waitFor();
    assert.equal(posts.length, 1); assert.ok(!("id" in posts[0]), "payload não pode conter id"); assert.deepEqual(posts[0], dados);
    const gravada = await ate("tarefa no arquivo temporário", async () => (await lerDb()).tarefas.find((t) => t.titulo === dados.titulo) || null);
    assert.equal(typeof gravada.id, "string");
    assert.deepEqual({ projetoId: gravada.projetoId, titulo: gravada.titulo, descricao: gravada.descricao, status: gravada.status, prioridade: gravada.prioridade, responsavel: gravada.responsavel, prazo: gravada.prazo }, dados);
  });
  await conferir("falha 500 no POST mantém dados e página", async () => {
    await page.route(`${apiUrl}/tarefas`, async (route) => route.request().method() !== "POST" ? route.continue() : route.fulfill({ status: 500, json: {} }));
    try {
      const dados = { ...base, titulo: "Tarefa que não deve ser perdida" };
      await abrir("/tarefas/nova"); await preencher(dados); await botaoSalvar().click();
      await page.getByRole("alert").filter({ hasText: "Não foi possível salvar a tarefa" }).waitFor();
      assert.equal(caminho().pathname, "/tarefas/nova"); assert.equal(await campo("Título").inputValue(), dados.titulo);
      assert.equal(await campo("Descrição").inputValue(), dados.descricao); assert.equal(await campo("Responsável").inputValue(), dados.responsavel);
      assert.equal(await campo("Prazo").inputValue(), dados.prazo); await ate("botão reabilitado após a falha", () => botaoEnvio().isEnabled());
    } finally { await page.unrouteAll(); }
  });
  await conferir("POST pendente bloqueia duplicidade e não navega antes da resposta", async () => {
    await page.route(`${apiUrl}/tarefas`, async (route) => { if (route.request().method() !== "POST") return route.continue(); await dormir(900); try { await route.continue(); } catch {} });
    try {
      posts.length = 0; await abrir("/tarefas/nova"); await preencher({ ...base, titulo: "Tarefa com envio pendente" }); await botaoSalvar().click();
      await ate("envio em curso", () => botaoEnvio().isDisabled()); assert.equal(caminho().pathname, "/tarefas/nova");
      await page.evaluate(() => document.querySelector("form")?.requestSubmit()); await dormir(200);
      assert.equal(posts.length, 1); assert.equal(caminho().pathname, "/tarefas/nova");
      await ate("lista após a resposta", async () => caminho().pathname === "/"); assert.equal(posts.length, 1);
    } finally { await page.unrouteAll(); }
  });
  await conferir("sair pelo menu durante POST retardado não redireciona ao chegar a resposta", async () => {
    await page.route(`${apiUrl}/tarefas`, async (route) => { if (route.request().method() !== "POST") return route.continue(); await dormir(900); try { await route.continue(); } catch {} });
    try {
      await abrir("/tarefas/nova"); await preencher({ ...base, titulo: "Tarefa abandonada no menu" }); await botaoSalvar().click();
      await ate("envio em curso", () => botaoEnvio().isDisabled());
      await page.getByRole("navigation").getByRole("link", { name: "Projetos", exact: true }).click();
      await page.getByRole("heading", { name: "Projetos", exact: true }).waitFor(); await dormir(1300);
      assert.equal(caminho().pathname, "/projetos");
    } finally { await page.unrouteAll(); }
  });
  await conferir("cancelar e voltar respeitam o contexto e a lista é o padrão", async () => {
    await abrir("/tarefas/nova?projetoId=1");
    assert.equal(await page.getByRole("link", { name: "Voltar para o projeto", exact: true }).getAttribute("href"), "/projetos/1");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.getByRole("heading", { name: seed.projetos[0].nome, exact: true }).waitFor(); assert.equal(caminho().pathname, "/projetos/1");
    await abrir("/tarefas/nova?projetoId=2"); await page.getByRole("link", { name: "Voltar para o projeto", exact: true }).click();
    await page.getByRole("heading", { name: seed.projetos[1].nome, exact: true }).waitFor(); assert.equal(caminho().pathname, "/projetos/2");
    await abrir("/tarefas/nova"); assert.equal(await page.getByRole("link", { name: "Voltar para tarefas", exact: true }).getAttribute("href"), "/");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click(); await ate("lista de tarefas", async () => caminho().pathname === "/");
  });
  await conferir("sucesso com contexto de projeto sempre volta para a lista", async () => {
    const dados = { ...base, projetoId: "2", titulo: "Tarefa contextual da suíte" };
    await abrir("/tarefas/nova?projetoId=2"); assert.equal(await campo("Projeto").inputValue(), "2");
    await preencher(dados); await botaoSalvar().click();
    await ate("lista após sucesso contextual", async () => caminho().pathname === "/");
    assert.equal(caminho().pathname + caminho().search, "/"); await page.getByRole("link", { name: dados.titulo, exact: true }).waitFor();
  });
  await conferir("projeto inexistente na query bloqueia até escolher um válido", async () => {
    posts.length = 0; await abrir("/tarefas/nova?projetoId=999"); assert.equal(await campo("Projeto").inputValue(), "999");
    await page.getByText("O projeto desta tarefa não foi encontrado. Escolha um projeto disponível.", { exact: true }).waitFor();
    assert.equal(await botaoEnvio().isDisabled(), true); await preencher({ ...base, projetoId: "" });
    await page.evaluate(() => document.querySelector("form")?.requestSubmit()); await dormir(200);
    assert.equal(posts.length, 0); assert.equal(caminho().pathname, "/tarefas/nova");
    await campo("Projeto").selectOption("1"); await ate("salvar liberado com projeto válido", () => botaoEnvio().isEnabled());
  });
  await conferir("largura de 320px sem overflow e navegação por teclado", async () => {
    await page.setViewportSize({ width: 320, height: 700 }); await abrir("/tarefas/nova");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth), true);
    await page.getByText("Responsável", { exact: true }).first().click();
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), await campo("Responsável").evaluate((el) => el.id));
    let alcancouBotao = false;
    for (let i = 0; i < 8 && !alcancouBotao; i++) { await page.keyboard.press("Tab"); alcancouBotao = await page.evaluate(() => document.activeElement instanceof HTMLButtonElement); }
    assert.equal(alcancouBotao, true, "Tab deve alcançar um botão do formulário");
    if (evidencias) await page.screenshot({ path: join(evidencias, "nova-tarefa-320.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await conferir("sem erros de página ou console e bancos reais intactos", async () => {
    assert.deepEqual(errosPagina, []); assert.deepEqual(errosConsole, []);
    assert.equal(await readFile(join(repo, "db.json"), "utf8"), bancoRealAntes);
    assert.equal(await readFile(join(repo, "db.seed.json"), "utf8"), seedAntes);
  });
  console.log(`${total} cenários aprovados; banco real intacto.`);
}
executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {}); await encerrar(processoWeb).catch(() => {}); await encerrar(processoApi).catch(() => {});
  if (dadosTemp) await rm(dadosTemp, { recursive: true, force: true });
});
