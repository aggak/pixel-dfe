const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { focoVisivel, lancarNavegador } = require("./ui.cjs");

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
  return processo;
}

// O build do GitHub Pages usa HashRouter e base /pixel-dfe/; roda até o fim antes do preview.
function gerarBuild(saida, api) {
  return new Promise((resolve, reject) => {
    const build = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--base=/pixel-dfe/", "--outDir", saida, "--emptyOutDir", "--logLevel", "error"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: api, VITE_GITHUB_PAGES: "true" } });
    build.stdout.on("data", () => {});
    build.stderr.on("data", (erro) => process.stderr.write(erro));
    build.once("exit", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`vite build terminou com código ${codigo}`))));
  });
}

let browser;
let temporario;
const processos = [];

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-visao-"));
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  const evidencias = process.env.VISAO_EVIDENCIAS;
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const [portaApi, portaWeb, portaPages] = [await portaLivre(), await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  const pages = `http://127.0.0.1:${portaPages}/pixel-dfe/`;
  iniciar(processos, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await gerarBuild(join(temporario, "pages"), api);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "preview", "--base=/pixel-dfe/", "--outDir", join(temporario, "pages"), "--host", "127.0.0.1", "--port", String(portaPages), "--strictPort"]);
  await Promise.all([pronto(`${api}/tarefas`), pronto(web), pronto(pages)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);
  const visao = page.getByRole("navigation", { name: "Visualização das tarefas" });
  const linkLista = visao.getByRole("link", { name: "Lista", exact: true });
  const linkQuadro = visao.getByRole("link", { name: "Quadro", exact: true });
  const menuTarefas = page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Tarefas", exact: true });
  const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
  const lista = page.getByRole("region", { name: "Lista de tarefas" });
  const ids = (regiao) => regiao.locator("[data-task-id]").evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId).sort());
  const busca = page.getByRole("searchbox", { name: "Buscar por título" });
  const seletor = (nome) => page.getByRole("button", { name: new RegExp(nome) });
  const selecionar = async (nome, opcao) => {
    await seletor(nome).click();
    const item = page.getByRole("option", { name: opcao, exact: true });
    await item.click();
    await item.waitFor({ state: "detached" });
  };
  const caminho = () => new URL(page.url()).pathname;
  const marcados = async () => [await linkLista.getAttribute("aria-current"), await linkQuadro.getAttribute("aria-current"), await menuTarefas.getAttribute("aria-current")];
  const conferirFiltros = async (texto, status, prioridade) => {
    assert.equal(await busca.inputValue(), texto);
    assert.match(await seletor("Status").innerText(), new RegExp(status));
    assert.match(await seletor("Prioridade").innerText(), new RegExp(prioridade));
  };
  const focado = () => page.evaluate(() => document.activeElement?.textContent ?? "");

  await page.goto(`${web}/`);
  await lista.getByRole("article").first().waitFor();
  assert.deepEqual(await marcados(), ["page", null, "page"]);
  console.log("OK: a lista mostra o controle com \"Lista\" marcada e \"Tarefas\" ativo no menu");

  // Os três critérios juntos: busca, status e prioridade fora do padrão numa mesma troca.
  // Marca no window: se a troca recarregasse o documento, a marca sumiria.
  await page.evaluate(() => { window.semRecarga = true; });
  await busca.fill("a");
  await selecionar("Status", "A fazer");
  await selecionar("Prioridade", "Média");
  const combinadas = seed.tarefas.filter((t) => t.titulo.toLocaleLowerCase("pt-BR").includes("a") && t.status === "a-fazer" && t.prioridade === "media").map((t) => t.id).sort();
  assert.ok(combinadas.length > 0 && combinadas.length < seed.tarefas.filter((t) => t.status === "a-fazer").length);
  assert.deepEqual(await ids(lista), combinadas);
  await linkQuadro.click();
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(caminho(), "/quadro");
  assert.equal(await lista.count(), 0);
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await ids(quadro), combinadas);
  assert.deepEqual(await marcados(), [null, "page", "page"]);
  assert.match(await page.locator(".e-sheet-footer").innerText(), new RegExp(`^${combinadas.length} tarefas?$`));
  console.log("OK: lista → quadro preserva busca, status e prioridade, sem recarregar o documento");

  await busca.fill("");
  await selecionar("Status", "Todos os status");
  await selecionar("Prioridade", "Alta");
  const altas = seed.tarefas.filter((t) => t.prioridade === "alta").map((t) => t.id).sort();
  assert.deepEqual(await ids(quadro), altas);
  await linkLista.click();
  await lista.getByRole("article").first().waitFor();
  assert.equal(caminho(), "/");
  await conferirFiltros("", "Todos os status", "Alta");
  assert.deepEqual(await ids(lista), altas);
  console.log("OK: quadro → lista preserva os filtros alterados no quadro");

  // Voltar e avançar do navegador também trocam de visão sem perder o estado.
  await page.goBack();
  await quadro.locator("[data-task-id]").first().waitFor();
  await conferirFiltros("", "Todos os status", "Alta");
  await page.goForward();
  await lista.getByRole("article").first().waitFor();
  await conferirFiltros("", "Todos os status", "Alta");
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  console.log("OK: voltar e avançar do navegador mantêm busca e filtros");

  // Teclado: Tab a partir da busca chega à visão; depois do Enter o foco continua no controle.
  await busca.focus();
  for (let passo = 0; passo < 6 && (await focado()) !== "Quadro"; passo++) await page.keyboard.press("Tab");
  assert.equal(await focado(), "Quadro");
  assert.equal(await focoVisivel(linkQuadro), true);
  await page.keyboard.press("Enter");
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(caminho(), "/quadro");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-current") === "page" && document.activeElement.textContent === "Quadro");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focado(), "Lista");
  await page.keyboard.press("Enter");
  await lista.getByRole("article").first().waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-current") === "page" && document.activeElement.textContent === "Lista");
  console.log("OK: Tab alcança o controle, Enter troca de visão e o foco não volta ao início da página");

  // Com a ficha aberta, o fundo segue marcado: Lista sob a lista, Quadro sob o quadro.
  const alvo = seed.tarefas.find((t) => t.prioridade === "alta");
  const detalhe = page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true });
  for (const [link, regiao, rota, esperado] of [[linkLista, lista, "/", ["page", null, "page"]], [linkQuadro, quadro, "/quadro", [null, "page", "page"]]]) {
    await link.click();
    await regiao.locator("[data-task-id]").first().waitFor();
    await regiao.getByRole("link", { name: alvo.titulo, exact: true }).click();
    await detalhe.waitFor();
    assert.deepEqual(await marcados(), esperado, rota);
    await page.keyboard.press("Escape");
    await detalhe.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === rota);
    await conferirFiltros("", "Todos os status", "Alta");
  }
  console.log("OK: a ficha sobre a lista e sobre o quadro mantém a visão marcada e os filtros");

  // O roteador aceita barra final e maiúsculas; os dois marcadores precisam concordar.
  for (const [rota, esperado] of [["/quadro/", [null, "page", "page"]], ["/QUADRO", [null, "page", "page"]], ["/?x=1", ["page", null, "page"]]]) {
    await page.goto(`${web}${rota}`);
    await page.locator("[data-task-id]").first().waitFor();
    assert.deepEqual(await marcados(), esperado, rota);
  }
  await page.goto(`${web}/projetos`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  assert.equal(await visao.count(), 0);
  assert.equal(await menuTarefas.getAttribute("aria-current"), null);
  console.log("OK: barra final e maiúsculas marcam a visão certa; fora das tarefas o controle some");

  // Controle e botão na mesma linha, dentro da folha, de 1280 a 320 px.
  for (const rota of ["/", "/quadro"]) {
    await page.goto(`${web}${rota}`);
    await page.locator("[data-task-id]").first().waitFor();
    for (const largura of [1280, 850, 700, 420, 375, 320]) {
      await page.setViewportSize({ width: largura, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${rota} em ${largura} px`);
      const folha = await page.locator(".e-sheet").boundingBox();
      const controle = await visao.boundingBox();
      const botao = await page.locator('[data-action="new-task"]').boundingBox();
      for (const caixa of [controle, botao]) assert.ok(caixa.x >= folha.x && caixa.x + caixa.width <= folha.x + folha.width, `${rota} em ${largura} px`);
      assert.ok(Math.abs(controle.y + controle.height - (botao.y + botao.height)) <= 2, `${rota} em ${largura} px: controle e botão em linhas diferentes`);
      assert.ok(botao.x > controle.x, `${rota} em ${largura} px`);
      if (largura <= 650) for (const link of [linkLista, linkQuadro]) assert.ok((await link.boundingBox()).height >= 38, `${rota} em ${largura} px`);
      if (evidencias) await page.screenshot({ path: join(evidencias, `visao${rota === "/" ? "-lista" : "-quadro"}-${largura}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  console.log("OK: controle e \"Nova tarefa\" dividem a linha dentro da folha, de 1280 a 320 px");

  // Build do GitHub Pages: HashRouter e base /pixel-dfe/.
  await page.goto(`${pages}#/`);
  await lista.getByRole("article").first().waitFor();
  await page.evaluate(() => { window.semRecarga = true; });
  await busca.fill("a");
  await selecionar("Status", "A fazer");
  await selecionar("Prioridade", "Média");
  await linkQuadro.click();
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(new URL(page.url()).hash, "#/quadro");
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await ids(quadro), combinadas);
  assert.deepEqual(await marcados(), [null, "page", "page"]);
  await linkLista.click();
  await lista.getByRole("article").first().waitFor();
  assert.equal(new URL(page.url()).hash, "#/");
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await marcados(), ["page", null, "page"]);
  console.log("OK: no build do GitHub Pages (HashRouter) a troca preserva busca e filtros");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("9 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
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
