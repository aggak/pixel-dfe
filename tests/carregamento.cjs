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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
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
      try {
        await rota.continue();
      } catch (erro) {
        // A navegação pode cancelar uma consulta ainda retida pelo teste.
        if (!String(erro).includes("Route is already handled")) throw erro;
      }
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
  await conferirRota("página do projeto mostra e retira carregamento", "/projetos/1", (url) => url.pathname === "/projetos/1", () => page.locator(".e-content").getByRole("status"));
  await conferirRota("detalhes da tarefa mostram e retiram carregamento", "/tarefas/1", (url) => url.pathname === "/tarefas/1", () => statusFicha("Carregando tarefa"));
  await conferirRota("nome do projeto na ficha mostra e retira carregamento", "/tarefas/1", (url) => url.pathname === "/projetos", () => page.getByRole("dialog").locator(".e-read-project [role=status]"));
  await conferirRota("edição da tarefa mostra e retira carregamento", "/tarefas/1/editar", (url) => url.pathname === "/tarefas/1", () => statusFicha("Carregando tarefa"));
  await conferirRota("nova tarefa mostra e retira carregamento dos projetos", "/tarefas/nova", (url) => url.pathname === "/projetos", () => statusFicha("Carregando projetos"));
  await conferirRota("edição do projeto mostra e retira carregamento", "/projetos/1/editar", (url) => url.pathname === "/projetos/1", () => statusFicha("Carregando projeto"));

  async function reter(caminho, transformar) {
    let iniciou;
    let liberar;
    let concluir;
    const conclusao = new Promise((resolve) => { concluir = resolve; });
    const requisicao = new Promise((resolve) => { iniciou = resolve; });
    const bloqueio = new Promise((resolve) => { liberar = resolve; });
    const interceptar = async (rota) => {
      if (rota.request().method() === "GET" && new URL(rota.request().url()).pathname === caminho) {
        iniciou();
        await bloqueio;
        if (transformar) {
          try {
            const resposta = await rota.fetch();
            await rota.fulfill({ response: resposta, json: transformar(await resposta.json()) });
          } catch (erro) {
            if (!String(erro).includes("Route is already handled")) throw erro;
          } finally {
            concluir();
          }
          return;
        }
      }
      await rota.continue().catch(() => {});
    };
    await page.route(`${api}/**`, interceptar);
    return { requisicao, liberar: async () => { liberar(); if (transformar) await conclusao; await page.unroute(`${api}/**`, interceptar); } };
  }

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [caminho, consulta, anuncio, nome, semDescricao = false] of [
      ["/tarefas/1/editar", "/tarefas/1", "Carregando tarefa", "Editar tarefa"],
      ["/tarefas/1/editar", "/tarefas/1", "Carregando tarefa", "Editar tarefa", true],
      ["/projetos/1/editar", "/projetos/1", "Carregando projeto", "Editar projeto"],
      ["/tarefas/nova", "/projetos", "Carregando projetos", "Nova tarefa"],
      ["/projetos/novo", "/projetos", "", "Novo projeto"],
    ]) {
      const consultaPendente = await reter(consulta, semDescricao ? (dados) => ({ ...dados, descricao: "" }) : undefined);
      try {
        await page.goto(`${web}${caminho}`);
        const ficha = page.getByRole("dialog", { name: nome, exact: true });
        await ficha.waitFor();
        if (anuncio) await statusFicha(anuncio).waitFor();
        else await ficha.locator("form").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const cabecalho = ficha.locator(".e-form-header");
        const topo = await cabecalho.evaluate((el) => el.getBoundingClientRect().top);
        const fechar = ficha.getByRole("button", { name: `Fechar ${nome.toLocaleLowerCase("pt-BR")}`, exact: true });
        await fechar.focus();
        await consultaPendente.liberar();
        await ficha.locator("form").waitFor();
        if (anuncio) await statusFicha(anuncio).waitFor({ state: "detached" });
        if (caminho === "/tarefas/1/editar") {
          await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some((el) => el.textContent.includes("Carregando projetos")));
        }
        const limite = width >= 650 ? 1 : caminho === "/tarefas/1/editar" ? 54 : caminho === "/tarefas/nova" ? 22 : 1;
        assert.ok(Math.abs(await cabecalho.evaluate((el) => el.getBoundingClientRect().top) - topo) < limite, `${caminho} em ${width}px: deslocamento deve ficar abaixo de ${limite}px`);
        assert.equal(await ficha.locator(".e-ficha-loading-tarefa,.e-ficha-loading-projeto").count(), 0, "formulário pronto não mantém a reserva de carregamento");
        if (width < 650 && (semDescricao || caminho === "/tarefas/nova")) {
          assert.ok((await ficha.boundingBox()).height < 500, "tarefa sem descrição mantém a altura natural, sem vão até o rodapé");
        }
        assert.equal(await fechar.isVisible(), true);
        assert.equal(await ficha.locator(":focus").count(), 1, "foco permanece dentro da ficha após carregar");
        if (width < 650) {
          const caixa = await fechar.boundingBox();
          assert.ok(caixa.width >= 44 && caixa.height >= 44, "fechar mantém alvo de toque móvel");
        }
      } finally {
        await consultaPendente.liberar();
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log("OK: reserva só nas edições carregando, resíduo limitado com/sem descrição e formulários prontos na altura natural em 320, 375 e 1280px");

  const andamento = await reter("/tarefas");
  await page.goto(`${web}/projetos`);
  await andamento.requisicao;
  await page.locator(".e-project-card").first().waitFor();
  const cartoes = await page.locator(".e-project-card").count();
  assert.equal(await page.locator(".e-project-card .e-proj-foot").filter({ hasText: "Carregando andamento…" }).count(), cartoes);
  assert.equal(await page.locator(".e-project-card .e-proj-foot .e-proj-bar-vazia").count(), cartoes);
  assert.equal(await page.locator(".e-project-card [role=status]").count(), 0, "cada cartão não deve anunciar o carregamento");
  assert.deepEqual(await page.getByRole("status").allTextContents(), ["Carregando o andamento dos projetos…"]);
  const alturaCarregando = await page.locator(".e-project-card").first().evaluate((cartao) => cartao.getBoundingClientRect().height);
  await andamento.liberar();
  await status("Carregando o andamento").waitFor({ state: "detached" });
  await page.locator(".e-project-card .e-proj-bar:not(.e-proj-bar-vazia)").first().waitFor();
  assert.equal(await page.getByText("Carregando andamento…").count(), 0);
  assert.equal(await page.locator(".e-project-card").first().evaluate((cartao) => cartao.getBoundingClientRect().height), alturaCarregando);
  console.log("OK: andamento dos cartões de projeto mostra um único anúncio de carregamento");

  await page.route(`${api}/tarefas`, (rota) => rota.fulfill({ status: 500, body: "{}" }));
  await page.goto(`${web}/projetos`);
  await page.getByText("O andamento dos projetos não carregou.").waitFor();
  assert.equal(await page.getByText("Carregando andamento…").count(), 0);
  assert.equal(await status("Carregando o andamento").count(), 0);
  await page.unroute(`${api}/tarefas`);
  console.log("OK: falha do andamento retira a indicação de carregamento dos cartões");

  const projeto = await reter("/projetos/1");
  await page.goto(`${web}/projetos/1`);
  await projeto.requisicao;
  await page.locator(".e-content").getByRole("status").waitFor();
  const detalhes = page.getByRole("button", { name: "Detalhes do projeto" });
  assert.equal(await detalhes.isDisabled(), true, "detalhes do projeto deve ficar desabilitado enquanto carrega");
  const topoCarregando = await page.locator(".e-content").evaluate((conteudo) => conteudo.getBoundingClientRect().top);
  await projeto.liberar();
  await page.locator(".e-list").waitFor();
  assert.equal(await detalhes.isEnabled(), true);
  assert.equal(await page.locator(".e-content").evaluate((conteudo) => conteudo.getBoundingClientRect().top), topoCarregando, "a faixa de detalhes não deve empurrar o conteúdo");
  await detalhes.click();
  await page.locator("#project-details").waitFor();
  console.log("OK: faixa de detalhes do projeto reservada desde o carregamento, sem salto");

  for (const [rota, resposta] of [["/projetos/1", 500], ["/projetos/999", 404]]) {
    await page.route(`${api}${rota}?*`, (r) => r.fulfill({ status: resposta, body: "{}" }));
    await page.goto(`${web}${rota}`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("button", { name: "Detalhes do projeto" }).count(), 0, `${rota}: erro sem faixa de detalhes`);
    await page.unroute(`${api}${rota}?*`);
  }
  console.log("OK: erro e projeto inexistente continuam sem a faixa de detalhes");

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
