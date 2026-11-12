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
  temporario = await mkdtemp(join(tmpdir(), "pixel-inexistente-"));
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
  const alerta = (texto) => page.getByRole("alert").filter({ hasText: texto });
  const ficha = () => page.locator(".e-form-overlay").getByRole("dialog");
  // Outro usuário (ou outra aba) remove o registro direto na API enquanto a tela está aberta.
  const removerNaApi = async (colecao, id) => assert.equal((await fetch(`${api}/${colecao}/${id}`, { method: "DELETE" })).ok, true);
  const criarNaApi = async (colecao, dados) => (await fetch(`${api}/${colecao}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) })).json();

  for (const caminho of ["/tarefas", "/tarefas/", "/TAREFAS?origem=atalho&busca=a%20b#lista", "/TaReFaS/?origem=atalho&busca=a%20b#lista"]) {
    const { search, hash } = new URL(caminho, web);
    const destino = `${web}/${search}${hash}`;
    await page.goto(`${web}/projetos`);
    await page.getByRole("region", { name: "Lista de projetos" }).waitFor();
    const historico = await page.evaluate(() => history.length);
    const resposta = await page.goto(`${web}${caminho}`);
    assert.equal(resposta.status(), 200);
    await page.waitForURL(destino, { timeout: 10000 });
    await page.getByRole("region", { name: "Lista de tarefas" }).locator("[data-task-id]").first().waitFor();
    assert.equal(await ficha().count(), 0);
    assert.equal(await page.evaluate(() => history.length), historico + 1, `${caminho}: redirecionamento empilhou histórico`);
    await page.goBack();
    await page.waitForURL(`${web}/projetos`, { timeout: 10000 });
    await page.getByRole("region", { name: "Lista de projetos" }).waitFor();
    await page.goForward();
    await page.waitForURL(destino, { timeout: 10000 });
    await page.getByRole("region", { name: "Lista de tarefas" }).locator("[data-task-id]").first().waitFor();
    console.log(`OK: ${caminho} leva à lista, preserva query/hash e substitui a entrada no histórico`);
  }

  const listaRedirecionada = page.url();
  await page.getByRole("region", { name: "Lista de tarefas" }).getByRole("link", { name: "Criar o repositório", exact: true }).click();
  await ficha().getByRole("heading", { name: "Criar o repositório", exact: true }).waitFor();
  const fundo = await page.evaluate(() => history.state.usr.fundo);
  assert.equal(fundo.pathname + fundo.search + fundo.hash, new URL(listaRedirecionada).pathname + new URL(listaRedirecionada).search + new URL(listaRedirecionada).hash);
  await page.keyboard.press("Escape");
  await ficha().waitFor({ state: "detached" });
  await page.waitForURL(listaRedirecionada, { timeout: 10000 });
  await page.getByRole("region", { name: "Lista de tarefas" }).waitFor();
  console.log("OK: a ficha aberta após o redirecionamento mantém o fundo e retorna à lista com query/hash");

  for (const caminho of ["/tarefas-extra", "/tarefas/999/extra"]) {
    await page.goto(`${web}${caminho}`);
    await page.getByRole("heading", { name: "Página não encontrada", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, caminho);
  }
  console.log("OK: endereços fora das rotas continuam na página não encontrada");

  for (const caminho of ["/tarefas/999", "/tarefas/999/editar"]) {
    await page.goto(`${web}${caminho}`);
    await ficha().getByRole("alert").filter({ hasText: "Tarefa não encontrada." }).waitFor();
    assert.equal(await page.title(), "Tarefa não encontrada · Pixel");
    assert.equal(await ficha().getByRole("status").count(), 0, `${caminho}: carregamento ativo`);
    console.log(`OK: ${caminho} encerra o carregamento com "Tarefa não encontrada."`);
  }
  for (const caminho of ["/projetos/999", "/projetos/999/editar"]) {
    await page.goto(`${web}${caminho}`);
    // A edição abre sobre a página do projeto: os dois avisos precisam chegar.
    await page.getByRole("main").getByRole("alert").filter({ hasText: "Projeto não encontrado" }).waitFor();
    if (caminho.endsWith("/editar")) await ficha().getByRole("alert").filter({ hasText: "Projeto não encontrado." }).waitFor();
    assert.equal(await page.title(), "Projeto não encontrado · Pixel");
    assert.equal(await page.getByRole("status").count(), 0, `${caminho}: carregamento ativo`);
    assert.equal(await page.getByRole("button", { name: "Tentar de novo" }).count(), 0, `${caminho}: oferece tentar de novo`);
    console.log(`OK: ${caminho} encerra o carregamento com "Projeto não encontrado"`);
  }

  // Resposta lenta: a indicação aparece e some quando o 404 chega.
  const atrasar = async (rota) => { await new Promise((resolve) => setTimeout(resolve, 600)); await rota.continue().catch(() => {}); };
  await page.route(`${api}/tarefas/998`, atrasar);
  await page.goto(`${web}/tarefas/998`);
  await ficha().getByRole("status").filter({ hasText: "Carregando tarefa" }).waitFor();
  assert.equal(await page.title(), "Tarefa · Pixel");
  await ficha().getByRole("alert").filter({ hasText: "Tarefa não encontrada." }).waitFor();
  assert.equal(await page.title(), "Tarefa não encontrada · Pixel");
  assert.equal(await ficha().getByRole("status").count(), 0);
  await page.unroute(`${api}/tarefas/998`, atrasar);
  console.log("OK: resposta lenta com 404 encerra a indicação de carregamento");

  async function abrirExclusao(titulo) {
    await page.getByRole("button", { name: `Ações de ${titulo}` }).click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    return page.getByRole("dialog", { name: `Excluir ${titulo}` });
  }
  for (const [caminho, id, titulo] of [["/", "2", "Subir o json-server"], ["/projetos/1", "3", "Montar o quadro no GitHub Projects"]]) {
    await page.goto(`${web}${caminho}`);
    await page.locator(`[data-task-id="${id}"]`).waitFor();
    await removerNaApi("tarefas", id);
    const dialogo = await abrirExclusao(titulo);
    await dialogo.getByRole("button", { name: "Excluir tarefa", exact: true }).click();
    await dialogo.waitFor({ state: "detached" });
    await page.locator(`[data-task-id="${id}"]`).waitFor({ state: "detached" });
    assert.equal(await alerta("Não foi possível excluir").count(), 0);
    console.log(`OK: ${caminho} excluir tarefa já excluída fecha o diálogo e remove o cartão`);
  }

  await page.goto(`${web}/`);
  await page.locator('[data-task-id="4"]').waitFor();
  await removerNaApi("tarefas", "4");
  await page.getByRole("button", { name: /^Mudar status de Listar as tarefas na tela/ }).click();
  await page.getByRole("menuitemradio", { name: "Concluída" }).click();
  await alerta("Esta tarefa não existe mais. Ela pode ter sido excluída.").waitFor();
  assert.equal(await alerta("Tente de novo").count(), 0);
  console.log("OK: mudar status de tarefa excluída avisa que ela não existe mais");

  const extra = await criarNaApi("tarefas", { projetoId: "1", titulo: "Revisar entrega", descricao: "", status: "a-fazer", prioridade: "media", responsavel: "Ana", prazo: "2026-12-01" });
  await page.goto(`${web}/tarefas/${extra.id}/editar`);
  const titulo = ficha().getByLabel(/^Título/);
  await titulo.waitFor();
  await removerNaApi("tarefas", extra.id);
  await titulo.fill("Título digitado depois da exclusão");
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await alerta("Esta tarefa não existe mais. Ela pode ter sido excluída; seus dados foram mantidos.").waitFor();
  assert.equal(await alerta("tente de novo").count(), 0);
  assert.equal(await titulo.inputValue(), "Título digitado depois da exclusão");
  console.log("OK: salvar tarefa excluída avisa que ela não existe mais e mantém o texto");

  const projeto = await criarNaApi("projetos", { nome: "Projeto efêmero", descricao: "", disciplina: "DFE", criadoEm: "2026-10-01" });
  await page.goto(`${web}/projetos/${projeto.id}/editar`);
  const nome = ficha().getByLabel(/^Nome/);
  await nome.waitFor();
  await removerNaApi("projetos", projeto.id);
  await nome.fill("Nome digitado depois da exclusão");
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await alerta("Este projeto não existe mais. Ele pode ter sido excluído; seus dados foram mantidos.").waitFor();
  assert.equal(await nome.inputValue(), "Nome digitado depois da exclusão");
  console.log("OK: salvar projeto excluído avisa que ele não existe mais e mantém o texto");

  // 404 ao criar (POST) não fala de registro excluído: nada existia antes, então vale o aviso padrão de falha.
  const recusarCriacao = (rota) => (rota.request().method() === "POST" ? rota.fulfill({ status: 404, body: "{}" }) : rota.continue()).catch(() => {});
  await page.route(`${api}/tarefas`, recusarCriacao);
  // Com ?projetoId a ficha recebe valores iniciais, mas continua sendo um cadastro.
  await page.goto(`${web}/tarefas/nova?projetoId=1`);
  const tituloNovo = ficha().getByLabel(/^Título/);
  await tituloNovo.waitFor();
  await tituloNovo.fill("Tarefa recusada pela API");
  await ficha().getByLabel(/^Responsável/).fill("Ana");
  await ficha().getByLabel(/^Prazo/).fill("2026-12-01");
  await ficha().getByRole("button", { name: /^Salvar/ }).click();
  await alerta("Não foi possível salvar a tarefa. Seus dados foram mantidos; tente de novo.").waitFor();
  assert.equal(await alerta("não existe mais").count(), 0);
  assert.equal(await tituloNovo.inputValue(), "Tarefa recusada pela API");
  await page.unroute(`${api}/tarefas`, recusarCriacao);
  console.log("OK: 404 ao criar tarefa mostra a falha padrão e mantém o texto");

  await page.route(`${api}/projetos`, recusarCriacao);
  await page.goto(`${web}/projetos/novo`);
  const nomeNovo = ficha().getByLabel(/^Nome/);
  await nomeNovo.waitFor();
  await nomeNovo.fill("Projeto recusado pela API");
  await ficha().getByLabel(/^Disciplina/).fill("DFE");
  await ficha().getByLabel(/^Criado em/).fill("2026-10-01");
  await ficha().getByRole("button", { name: /^Salvar/ }).click();
  await alerta("Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo.").waitFor();
  assert.equal(await alerta("não existe mais").count(), 0);
  assert.equal(await nomeNovo.inputValue(), "Projeto recusado pela API");
  await page.unroute(`${api}/projetos`, recusarCriacao);
  console.log("OK: 404 ao criar projeto mostra a falha padrão e mantém o texto");

  const orfa = await criarNaApi("tarefas", { projetoId: "999", titulo: "Tarefa sem projeto", descricao: "", status: "a-fazer", prioridade: "baixa", responsavel: "Bia", prazo: "2026-12-01" });
  await page.goto(`${web}/tarefas/${orfa.id}`);
  await ficha().getByRole("heading", { name: "Tarefa sem projeto" }).waitFor();
  await ficha().locator(".e-read-project").getByText("Projeto não encontrado").waitFor();
  assert.equal(await ficha().locator(".e-read-project").getByRole("link").count(), 0);
  console.log("OK: tarefa com projeto inexistente não oferece link quebrado");

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
