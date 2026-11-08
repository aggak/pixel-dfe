// Issue #52: gera o build de produção (tsc -b + vite build) em pastas temporárias e confere,
// pelo vite preview, que o bundle compilado usa a URL de .env.production e que navegação,
// fichas React.lazy e todas as gravações funcionam sobre os arquivos estáticos.
// A API pública nunca é tocada: o build padrão é servido com a Railway interceptada no
// navegador, e o fluxo de escrita roda num segundo build apontado para um json-server
// sobre cópia temporária do db.seed.json.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, readdir, rm, stat } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join, relative, sep } = require("node:path");
const { comTextos, criarUi, lancarNavegador, TEXTO_STATUS } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const API_PRODUCAO = "https://pixel-dfe-production.up.railway.app";
const FICHAS_LAZY = ["NovaTarefa", "EditarTarefa", "NovoProjeto", "EditarProjeto"];
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
  for (let tentativa = 0; tentativa < 150; tentativa++) {
    if (processos.some((processo) => processo.exitCode !== null)) {
      throw new Error("Servidor encerrou antes do teste.");
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(arquivo, argumentos, env = process.env) {
  const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], {
    cwd: raiz,
    env,
    windowsHide: true,
    stdio: "pipe",
  });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (dado) => process.stderr.write(dado));
  processos.push(processo);
  return processo;
}

// Processo que precisa terminar com sucesso antes do próximo passo (tsc -b, vite build).
function rodar(descricao, arquivo, argumentos, env) {
  return new Promise((resolve, reject) => {
    const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], { cwd: raiz, env, windowsHide: true, stdio: "pipe" });
    let saida = "";
    processo.stdout.on("data", (dado) => { saida += dado; });
    processo.stderr.on("data", (dado) => { saida += dado; });
    processo.once("error", reject);
    processo.once("exit", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`${descricao} terminou com código ${codigo}:\n${saida}`))));
  });
}

// Ambiente sem VITE_API_URL nem VITE_GITHUB_PAGES herdados do shell: variáveis do processo
// têm prioridade sobre os arquivos .env, então só assim o Vite lê .env.production sozinho.
function ambienteLimpo(extra = {}) {
  const env = { ...process.env, ...extra };
  if (!("VITE_API_URL" in extra)) delete env.VITE_API_URL;
  delete env.VITE_GITHUB_PAGES;
  return env;
}

async function arquivos(pasta) {
  const lista = [];
  for (const item of await readdir(pasta, { withFileTypes: true, recursive: true })) {
    if (item.isFile()) lista.push(relative(pasta, join(item.parentPath, item.name)).split(sep).join("/"));
  }
  return lista.sort();
}

// Retrato do dist/ da raiz (nomes, tamanhos e datas) para provar que o teste não o toca.
async function retratoDist() {
  const pasta = join(raiz, "dist");
  try {
    const nomes = await arquivos(pasta);
    return Promise.all(nomes.map(async (nome) => {
      const info = await stat(join(pasta, nome));
      return `${nome}:${info.size}:${info.mtimeMs}`;
    }));
  } catch (erro) {
    if (erro.code === "ENOENT") return "ausente";
    throw erro;
  }
}

async function gerarBuild(saida, env) {
  await rodar("vite build", "node_modules/vite/bin/vite.js", ["build", "--outDir", saida, "--emptyOutDir", "--logLevel", "error"], env);
  const lista = await arquivos(saida);
  const chunk = (nome) => lista.find((arquivo) => new RegExp(`^assets/${nome}-[\\w-]+\\.js$`).test(arquivo));
  return { lista, chunks: Object.fromEntries(FICHAS_LAZY.map((nome) => [nome, chunk(nome)])) };
}

async function subirPreview(saida) {
  const porta = await portaLivre();
  const web = `http://127.0.0.1:${porta}`;
  iniciar("node_modules/vite/bin/vite.js", ["preview", "--outDir", saida, "--host", "127.0.0.1", "--port", String(porta), "--strictPort"], ambienteLimpo());
  await esperar(web);
  return web;
}

// Fontes e ícones de CDN são abortados: o teste não depende da rede externa.
// Os pedidos à API de produção são respondidos pelo `responderProducao`, quando houver.
async function isolarRede(contexto, externos, responderProducao) {
  await contexto.route("**/*", (rota) => {
    const url = rota.request().url();
    if (url.startsWith(`${API_PRODUCAO}/`)) {
      return (responderProducao ? responderProducao(rota) : rota.abort("blockedbyclient")).catch(() => {});
    }
    if (/^https?:\/\/127\.0\.0\.1[:/]/.test(url) || !/^https?:/.test(url)) return rota.continue().catch(() => {});
    externos.push(url);
    return rota.abort("blockedbyclient").catch(() => {});
  });
}

async function executar() {
  const protegidos = ["db.json", "db.seed.json", "src/tipos.ts"];
  const originais = await Promise.all(protegidos.map((arquivo) => readFile(join(raiz, arquivo), "utf8")));
  const seed = JSON.parse(originais[1]);
  const distAntes = await retratoDist();
  const notices = await readFile(join(raiz, "public/design-licenses/THIRD_PARTY_NOTICES.txt"), "utf8");
  const favicon = await readFile(join(raiz, "public/favicon.svg"), "utf8");
  temporario = await mkdtemp(join(tmpdir(), "pixel-build-producao-"));

  // 1. Compilação real com .env.production, fora do dist/ da raiz.
  await rodar("tsc -b", "node_modules/typescript/bin/tsc", ["-b"], ambienteLimpo());
  const saidaProducao = join(temporario, "producao");
  const producao = await gerarBuild(saidaProducao, ambienteLimpo());
  for (const arquivo of ["index.html", "favicon.svg", "design-licenses/THIRD_PARTY_NOTICES.txt"]) {
    assert.ok(producao.lista.includes(arquivo), `${arquivo} ausente no build: ${producao.lista.join(", ")}`);
  }
  assert.equal(await readFile(join(saidaProducao, "design-licenses/THIRD_PARTY_NOTICES.txt"), "utf8"), notices);
  const js = producao.lista.filter((arquivo) => arquivo.endsWith(".js"));
  const css = producao.lista.filter((arquivo) => arquivo.startsWith("assets/") && arquivo.endsWith(".css"));
  assert.ok(js.length >= 5 && css.length >= 1, `chunks insuficientes: ${producao.lista.join(", ")}`);
  for (const nome of FICHAS_LAZY) assert.ok(producao.chunks[nome], `chunk React.lazy de ${nome} ausente`);
  const indexHtml = await readFile(join(saidaProducao, "index.html"), "utf8");
  for (const nome of FICHAS_LAZY) assert.ok(!indexHtml.includes(producao.chunks[nome]), `${nome} não deveria estar no index.html`);
  const conteudos = await Promise.all(producao.lista.filter((arquivo) => /\.(js|html|css)$/.test(arquivo)).map(async (arquivo) => [arquivo, await readFile(join(saidaProducao, arquivo), "utf8")]));
  assert.ok(conteudos.some(([arquivo, texto]) => arquivo.endsWith(".js") && texto.includes(API_PRODUCAO)), "URL de produção ausente dos bundles");
  const comLocalhost = conteudos.filter(([, texto]) => texto.includes("localhost:3000")).map(([arquivo]) => arquivo);
  assert.deepEqual(comLocalhost, []);
  console.log(`OK: tsc -b e vite build geram index.html, favicon.svg, licenças, ${js.length} JS e ${css.length} CSS, com os 4 chunks React.lazy fora do index.html`);
  console.log(`OK: os bundles embutem ${API_PRODUCAO} (.env.production) e nenhum arquivo cita localhost:3000`);

  browser = await lancarNavegador();
  const errosPagina = [];

  // 2. O build padrão servido pelo vite preview chama a API de produção (interceptada).
  const webProducao = await subirPreview(saidaProducao);
  const pedidosProducao = [];
  const externosProducao = [];
  const contextoProducao = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await isolarRede(contextoProducao, externosProducao, (rota) => {
    const requisicao = rota.request();
    const caminho = new URL(requisicao.url()).pathname;
    pedidosProducao.push(`${requisicao.method()} ${requisicao.url()}`);
    const cabecalhos = { "access-control-allow-origin": "*" };
    const corpo = requisicao.method() === "GET" && { "/tarefas": seed.tarefas, "/projetos": seed.projetos }[caminho];
    if (corpo) return rota.fulfill({ status: 200, contentType: "application/json", headers: cabecalhos, body: JSON.stringify(corpo) });
    return rota.fulfill({ status: 405, contentType: "application/json", headers: cabecalhos, body: "{}" });
  });
  const paginaProducao = await contextoProducao.newPage();
  paginaProducao.setDefaultTimeout(10000);
  paginaProducao.on("pageerror", (erro) => errosPagina.push(`produção: ${erro.message}`));
  await paginaProducao.goto(`${webProducao}/`);
  const listaProducao = paginaProducao.getByRole("region", { name: "Lista de tarefas" });
  await listaProducao.getByRole("article").first().waitFor();
  assert.equal(await listaProducao.locator("[data-task-id]").count(), seed.tarefas.length);
  for (const tarefa of seed.tarefas) await listaProducao.getByRole("link", { name: tarefa.titulo, exact: true }).waitFor();
  assert.ok(pedidosProducao.includes(`GET ${API_PRODUCAO}/tarefas`), pedidosProducao.join(", "));
  assert.ok(pedidosProducao.includes(`GET ${API_PRODUCAO}/projetos`), pedidosProducao.join(", "));
  assert.deepEqual(pedidosProducao.filter((pedido) => !pedido.startsWith("GET ")), []);
  await contextoProducao.close();
  console.log(`OK: o build padrão no vite preview pede GET ${API_PRODUCAO}/tarefas e /projetos (interceptados) e renderiza os ${seed.tarefas.length} cartões`);

  // 3. Segundo build apontado para um json-server isolado, servido pelo vite preview.
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const portaApi = await portaLivre();
  const api = `http://127.0.0.1:${portaApi}`;
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  const saidaLocal = join(temporario, "local");
  const [local] = await Promise.all([gerarBuild(saidaLocal, ambienteLimpo({ VITE_API_URL: api })), esperar(`${api}/tarefas`)]);
  for (const nome of FICHAS_LAZY) assert.ok(local.chunks[nome], `chunk React.lazy de ${nome} ausente no build local`);
  const web = await subirPreview(saidaLocal);
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));

  const externos = [];
  const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await isolarRede(contexto, externos);
  const page = await contexto.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (erro) => errosPagina.push(`local: ${erro.message}`));
  const chunksPedidos = new Set();
  const gravacoes = [];
  const pedidosRailway = [];
  let documentos = 0;
  page.on("request", (requisicao) => {
    const url = new URL(requisicao.url());
    if (requisicao.resourceType() === "document") documentos++;
    if (url.origin === API_PRODUCAO) pedidosRailway.push(requisicao.url());
    if (url.origin === web && url.pathname.startsWith("/assets/")) chunksPedidos.add(url.pathname.slice(1));
    if (url.origin === api && requisicao.method() !== "GET") {
      gravacoes.push({ metodo: requisicao.method(), caminho: url.pathname, dados: requisicao.postDataJSON() });
    }
  });
  const fichasCarregadas = () => FICHAS_LAZY.filter((nome) => chunksPedidos.has(local.chunks[nome]));
  const caminho = () => new URL(page.url()).pathname;
  const lista = page.getByRole("region", { name: "Lista de tarefas" });
  const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
  const menuPrincipal = page.getByRole("navigation", { name: "Navegação principal" });
  const visao = page.getByRole("navigation", { name: "Visualização das tarefas" });
  const projeto1 = seed.projetos.find((p) => p.id === "1");
  const telas = {
    "/": () => lista.getByRole("article").first().waitFor(),
    "/quadro": () => quadro.locator("[data-task-id]").first().waitFor(),
    "/projetos": () => page.locator("main").getByRole("link", { name: projeto1.nome, exact: true }).waitFor(),
    "/projetos/1": () => page.getByRole("heading", { level: 1, name: projeto1.nome, exact: true }).waitFor(),
    "/tarefas/1": () => page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).getByRole("heading", { name: seed.tarefas[0].titulo, exact: true }).waitFor(),
    "/rota-inexistente": () => page.getByRole("heading", { level: 1, name: "Página não encontrada", exact: true }).waitFor(),
  };

  // Assets estáticos servidos pelo preview, incluindo o link "Licenças" do rodapé.
  await page.goto(`${web}/`);
  await telas["/"]();
  const hrefLicencas = await page.getByRole("link", { name: "Licenças", exact: true }).getAttribute("href");
  assert.equal(hrefLicencas, "/design-licenses/THIRD_PARTY_NOTICES.txt");
  const respostaFavicon = await fetch(`${web}/favicon.svg`);
  assert.equal(respostaFavicon.status, 200);
  assert.match(respostaFavicon.headers.get("content-type"), /image\/svg\+xml/);
  assert.equal(await respostaFavicon.text(), favicon);
  const respostaLicencas = await fetch(new URL(hrefLicencas, web));
  assert.equal(respostaLicencas.status, 200);
  assert.equal(await respostaLicencas.text(), notices);
  console.log("OK: o preview serve /favicon.svg e o link Licenças (THIRD_PARTY_NOTICES.txt) com HTTP 200 e o conteúdo de public/");

  // Navegação SPA: cliques trocam de tela sem novo documento.
  await page.evaluate(() => { window.semRecarga = true; });
  const documentosAntes = documentos;
  await visao.getByRole("link", { name: "Quadro", exact: true }).click();
  await telas["/quadro"]();
  assert.equal(caminho(), "/quadro");
  await menuPrincipal.getByRole("link", { name: "Projetos", exact: true }).click();
  await telas["/projetos"]();
  assert.equal(caminho(), "/projetos");
  await page.locator("main").getByRole("link", { name: projeto1.nome, exact: true }).click();
  await telas["/projetos/1"]();
  assert.equal(caminho(), "/projetos/1");
  await menuPrincipal.getByRole("link", { name: "Tarefas", exact: true }).click();
  await telas["/"]();
  assert.equal(caminho(), "/");
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  assert.equal(documentos, documentosAntes);
  console.log("OK: / → /quadro → /projetos → /projetos/1 → / pelo menu, sem recarregar o documento");

  // Acesso direto e recarga em cada rota, inclusive a inexistente.
  for (const [rota, conferir] of Object.entries(telas)) {
    const resposta = await page.goto(`${web}${rota}`);
    assert.equal(resposta.status(), 200, rota);
    await conferir();
    await page.reload();
    await conferir();
    assert.equal(caminho(), rota);
  }
  console.log(`OK: acesso direto e recarga funcionam no preview em ${Object.keys(telas).join(", ")}`);

  // Busca + status + prioridade combinados, preservados entre Lista e Quadro.
  const busca = page.getByRole("searchbox", { name: "Buscar por título" });
  const filtro = (nome) => page.locator(".e-task-filters").getByRole("button", { name: new RegExp(nome) });
  const selecionarFiltro = async (nome, valor) => {
    await filtro(nome).click();
    const item = page.getByRole("option", { name: valor, exact: true });
    await item.click();
    await item.waitFor({ state: "detached" });
  };
  const ids = (regiao) => regiao.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId).sort());
  const conferirFiltros = async () => {
    assert.equal(await busca.inputValue(), "a");
    assert.match(await filtro("Status").innerText(), /A fazer/);
    assert.match(await filtro("Prioridade").innerText(), /Média/);
  };
  await page.goto(`${web}/`);
  await telas["/"]();
  await page.evaluate(() => { window.semRecarga = true; });
  await busca.fill("a");
  await selecionarFiltro("Status", "A fazer");
  await selecionarFiltro("Prioridade", "Média");
  const combinadas = seed.tarefas.filter((t) => t.titulo.toLocaleLowerCase("pt-BR").includes("a") && t.status === "a-fazer" && t.prioridade === "media").map((t) => t.id).sort();
  assert.ok(combinadas.length > 0 && combinadas.length < seed.tarefas.length);
  await page.waitForFunction((n) => document.querySelectorAll("[data-task-id]").length === n, combinadas.length);
  assert.deepEqual(await ids(lista), combinadas);
  await visao.getByRole("link", { name: "Quadro", exact: true }).click();
  await telas["/quadro"]();
  await conferirFiltros();
  assert.deepEqual(await ids(quadro), combinadas);
  await visao.getByRole("link", { name: "Lista", exact: true }).click();
  await telas["/"]();
  await conferirFiltros();
  assert.deepEqual(await ids(lista), combinadas);
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  await busca.fill("");
  await selecionarFiltro("Status", "Todos os status");
  await selecionarFiltro("Prioridade", "Todas as prioridades");
  await page.waitForFunction((n) => document.querySelectorAll("[data-task-id]").length === n, seed.tarefas.length);
  console.log("OK: busca + status + prioridade filtram a lista e se mantêm ao ir para o quadro e voltar");

  // Até aqui nenhuma ficha de formulário foi aberta: os chunks React.lazy não podem ter sido baixados.
  assert.deepEqual(fichasCarregadas(), []);
  const ui = criarUi(page);
  const fichaAberta = (titulo) => page.getByRole("dialog", { name: titulo, exact: true });
  const esperarChunk = async (nome) => {
    await page.waitForFunction(() => document.querySelector(".e-form-overlay form"));
    assert.ok(chunksPedidos.has(local.chunks[nome]), `chunk ${local.chunks[nome]} não foi baixado`);
  };

  // Criar projeto (chunk NovoProjeto).
  const novoProjeto = { nome: "Projeto do build de produção", descricao: "Criado pela suíte da issue #52", disciplina: "Desenvolvimento Frontend", criadoEm: "2026-11-08" };
  await page.goto(`${web}/projetos`);
  await telas["/projetos"]();
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  await fichaAberta("Novo projeto").waitFor();
  await esperarChunk("NovoProjeto");
  assert.deepEqual(fichasCarregadas(), ["NovoProjeto"]);
  for (const [rotulo, chave] of [["Nome", "nome"], ["Descrição", "descricao"], ["Disciplina", "disciplina"], ["Criado em", "criadoEm"]]) await ui.campo(rotulo).fill(novoProjeto[chave]);
  gravacoes.length = 0;
  await page.getByRole("button", { name: "Salvar projeto", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/projetos");
  await page.locator("main").getByRole("link", { name: novoProjeto.nome, exact: true }).waitFor();
  assert.deepEqual(gravacoes, [{ metodo: "POST", caminho: "/projetos", dados: novoProjeto }]);
  const projetoCriado = (await lerBanco()).projetos.find((p) => p.nome === novoProjeto.nome);
  assert.deepEqual(projetoCriado, { id: projetoCriado?.id, ...novoProjeto });
  console.log("OK: o chunk NovoProjeto carrega sob demanda e o POST /projetos grava o projeto novo");

  // Editar projeto (chunk EditarProjeto).
  const edicaoProjeto = { nome: "Gerenciador de Tarefas (build)", descricao: projeto1.descricao, disciplina: projeto1.disciplina, criadoEm: projeto1.criadoEm };
  await page.goto(`${web}/projetos/1/editar`);
  await fichaAberta("Editar projeto").waitFor();
  await esperarChunk("EditarProjeto");
  await page.waitForFunction((nome) => document.querySelector(".e-form-overlay input")?.value === nome, projeto1.nome);
  await ui.campo("Nome").fill(edicaoProjeto.nome);
  gravacoes.length = 0;
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/projetos/1");
  await page.getByRole("heading", { level: 1, name: edicaoProjeto.nome, exact: true }).waitFor();
  assert.deepEqual(gravacoes, [{ metodo: "PATCH", caminho: "/projetos/1", dados: edicaoProjeto }]);
  assert.deepEqual((await lerBanco()).projetos.find((p) => p.id === "1"), { id: "1", ...edicaoProjeto });
  console.log("OK: o chunk EditarProjeto carrega sob demanda e o PATCH /projetos/1 grava a edição");

  // Criar tarefa (chunk NovaTarefa).
  const projetos = (await lerBanco()).projetos;
  const novaTarefa = { projetoId: "2", titulo: "Tarefa do build de produção", descricao: "Criada sobre o vite preview", status: "a-fazer", prioridade: "alta", responsavel: "Euclides", prazo: "2026-11-10" };
  await page.goto(`${web}/`);
  await telas["/"]();
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await fichaAberta("Nova tarefa").waitFor();
  await esperarChunk("NovaTarefa");
  await page.waitForFunction(() => document.querySelector(".e-form-overlay form"));
  for (let espera = 0; espera < 100 && !(await ui.projetosCarregados(projetos.length)); espera++) await page.waitForTimeout(100);
  await ui.preencherTarefa(comTextos(novaTarefa, projetos));
  gravacoes.length = 0;
  await page.getByRole("button", { name: "Salvar tarefa", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await lista.getByRole("link", { name: novaTarefa.titulo, exact: true }).waitFor();
  assert.deepEqual(gravacoes, [{ metodo: "POST", caminho: "/tarefas", dados: novaTarefa }]);
  const tarefaCriada = (await lerBanco()).tarefas.find((t) => t.titulo === novaTarefa.titulo);
  assert.deepEqual(tarefaCriada, { id: tarefaCriada?.id, ...novaTarefa });
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${seed.tarefas.length + 1} tarefas`);
  console.log("OK: o chunk NovaTarefa carrega sob demanda e o POST /tarefas grava a tarefa nova");

  // Detalhe e edição de tarefa (chunk EditarTarefa).
  const tarefa1 = seed.tarefas[0];
  await lista.getByRole("link", { name: tarefa1.titulo, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/tarefas/1");
  await telas["/tarefas/1"]();
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
  await fichaAberta("Editar tarefa").waitFor();
  assert.equal(caminho(), "/tarefas/1/editar");
  await esperarChunk("EditarTarefa");
  await page.waitForFunction((titulo) => [...document.querySelectorAll(".e-form-overlay input")].some((el) => el.value === titulo), tarefa1.titulo);
  const edicaoTarefa = { ...tarefa1, titulo: "Criar o repositório (build)", responsavel: "Gabriela" };
  delete edicaoTarefa.id;
  await ui.campo("Título").fill(edicaoTarefa.titulo);
  await ui.campo("Responsável").fill(edicaoTarefa.responsavel);
  gravacoes.length = 0;
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/tarefas/1");
  await page.getByRole("heading", { name: edicaoTarefa.titulo, exact: true }).waitFor();
  assert.deepEqual(gravacoes, [{ metodo: "PATCH", caminho: "/tarefas/1", dados: edicaoTarefa }]);
  assert.deepEqual((await lerBanco()).tarefas.find((t) => t.id === "1"), { id: "1", ...edicaoTarefa });
  assert.deepEqual(fichasCarregadas().sort(), [...FICHAS_LAZY].sort());
  console.log("OK: o detalhe abre, o chunk EditarTarefa carrega sob demanda e o PATCH /tarefas/1 grava a edição");

  // Mudar status pelo selo do cartão no quadro.
  const coluna = (status) => quadro.locator(`[data-status-column="${status}"]`);
  await page.goto(`${web}/quadro`);
  await telas["/quadro"]();
  const seletorStatus = page.getByRole("button", { name: new RegExp(`^Mudar status de ${novaTarefa.titulo} \\(atual:`) });
  await seletorStatus.click();
  gravacoes.length = 0;
  await page.getByRole("menu", { name: new RegExp(`^Mudar status de ${novaTarefa.titulo}`) }).getByRole("menuitemradio", { name: TEXTO_STATUS["em-revisao"], exact: true }).click();
  await coluna("em-revisao").locator(`[data-task-id="${tarefaCriada.id}"]`).waitFor();
  assert.deepEqual(gravacoes, [{ metodo: "PATCH", caminho: `/tarefas/${tarefaCriada.id}`, dados: { status: "em-revisao" } }]);
  assert.equal((await lerBanco()).tarefas.find((t) => t.id === tarefaCriada.id).status, "em-revisao");
  assert.equal(await page.locator(`[data-task-id="${tarefaCriada.id}"]`).count(), 1);
  console.log("OK: o selo do cartão no quadro grava só o status e move o cartão para a coluna nova");

  // Excluir tarefa com confirmação.
  const cartao = page.locator(`[data-task-id="${tarefaCriada.id}"]`);
  const dialogoExcluir = page.getByRole("dialog", { name: `Excluir ${novaTarefa.titulo}` });
  await cartao.getByRole("button", { name: `Ações de ${novaTarefa.titulo}` }).click();
  await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
  await dialogoExcluir.waitFor();
  assert.match(await dialogoExcluir.innerText(), /não pode ser desfeita/);
  gravacoes.length = 0;
  await dialogoExcluir.getByRole("button", { name: "Excluir tarefa" }).click();
  await cartao.waitFor({ state: "detached" });
  assert.deepEqual(gravacoes, [{ metodo: "DELETE", caminho: `/tarefas/${tarefaCriada.id}`, dados: null }]);
  assert.equal((await lerBanco()).tarefas.some((t) => t.id === tarefaCriada.id), false);
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${seed.tarefas.length} tarefas`);
  await page.reload();
  await telas["/quadro"]();
  assert.equal(await cartao.count(), 0);
  console.log("OK: a exclusão confirmada chama DELETE, some do quadro e continua fora após recarregar");

  assert.deepEqual(pedidosRailway, []);
  console.log("OK: o build local nunca chamou a API de produção; fontes e ícones de CDN ficaram bloqueados");
  await contexto.close();

  assert.deepEqual(errosPagina, []);
  const atuais = await Promise.all(protegidos.map((arquivo) => readFile(join(raiz, arquivo), "utf8")));
  protegidos.forEach((arquivo, i) => assert.equal(atuais[i], originais[i], `${arquivo} foi alterado`));
  assert.deepEqual(await retratoDist(), distAntes);
  console.log("OK: sem erros JavaScript; db.json, db.seed.json, src/tipos.ts e dist/ da raiz preservados");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close().catch(() => {});
    for (const processo of processos) {
      if (processo.exitCode === null && processo.signalCode === null) {
        const encerrado = new Promise((resolve) => processo.once("exit", resolve));
        processo.kill();
        await encerrado;
      }
    }
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
