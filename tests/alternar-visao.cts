const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { criarUi, focoVisivel } = require("./ui.cts");

function gerarBuild(saida, api) {
  return apoio.rodar(
    "vite build",
    "node_modules/vite/bin/vite.js",
    ["build", "--outDir", saida, "--emptyOutDir", "--logLevel", "error"],
    { ...process.env, VITE_API_URL: api },
    { exibirErros: true },
  );
}

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

let browser;

async function executar() {
  const { temporario, banco } = await apoio.criarBanco({
    prefixo: "pixel-visao-",
  });
  const originais = await Promise.all(
    ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
      readFile(arquivo, "utf8"),
    ),
  );
  const evidencias = process.env.VISAO_EVIDENCIAS;
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  const { api, web } = await apoio.subirAmbiente({ banco, tentativas: 300 });
  const portaProducao = await apoio.portaLivre();
  const producao = `http://127.0.0.1:${portaProducao}`;
  await gerarBuild(join(temporario, "producao"), api);
  apoio.iniciarVite(portaProducao, { preview: join(temporario, "producao") });
  await apoio.esperar(producao, { tentativas: 300 });

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);
  const visao = page.getByRole("navigation", {
    name: "Visualização das tarefas",
  });
  const linkLista = visao.getByRole("link", { name: "Lista", exact: true });
  const linkQuadro = visao.getByRole("link", { name: "Quadro", exact: true });
  const menuTarefas = page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Tarefas", exact: true });
  const quadro = page.getByRole("region", {
    name: "Quadro de tarefas por status",
  });
  const lista = page.getByRole("region", { name: "Lista de tarefas" });
  const ids = (regiao) =>
    regiao
      .locator("[data-task-id]")
      .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId).sort());
  const busca = page.getByRole("searchbox", { name: "Buscar por título" });
  const seletor = (nome) =>
    page.getByRole("button", { name: new RegExp(nome) });
  const selecionar = async (nome, opcao) => {
    await seletor(nome).click();
    const item = page.getByRole("option", { name: opcao, exact: true });
    await item.click();
    await item.waitFor({ state: "detached" });
  };
  const caminho = () => new URL(page.url()).pathname;
  const marcados = async () => [
    await linkLista.getAttribute("aria-current"),
    await linkQuadro.getAttribute("aria-current"),
    await menuTarefas.getAttribute("aria-current"),
  ];
  const conferirFiltros = async (texto, status, prioridade) => {
    assert.equal(await busca.inputValue(), texto);
    assert.match(await seletor("Status").innerText(), new RegExp(status));
    assert.match(
      await seletor("Prioridade").innerText(),
      new RegExp(prioridade),
    );
  };
  const focado = () =>
    page.evaluate(() => document.activeElement?.textContent ?? "");
  const trocarSemCarga = async (link, regiao, esperadas) => {
    let liberar;
    const bloqueio = new Promise((resolve) => {
      liberar = resolve;
    });
    const filtro = (url) =>
      url.origin === api && ["/tarefas", "/projetos"].includes(url.pathname);
    await page.route(filtro, async (route) => {
      await bloqueio;
      await route.continue();
    });
    const consultas = ["tarefas", "projetos"].map((colecao) =>
      page.waitForRequest(`${api}/${colecao}`),
    );
    try {
      await page.evaluate(() => window.scrollTo(0, 400));
      await link.click();
      await Promise.all(consultas);
      assert.equal(
        await page.getByText("Carregando tarefas…", { exact: true }).count(),
        0,
      );
      assert.deepEqual(await ids(regiao), esperadas);
      assert.ok(await regiao.locator(".e-task-project").first().textContent());
      assert.equal(await page.evaluate(() => scrollY), 0);
      for (const seletor of [".e-top", ".e-tabs", ".e-footer"])
        assert.equal(
          await page.locator(seletor).evaluate((el) => el.marcaPersistente),
          true,
          seletor,
        );
    } finally {
      const respostas = ["tarefas", "projetos"].map((colecao) =>
        page.waitForResponse(`${api}/${colecao}`),
      );
      liberar();
      await Promise.all(respostas);
      await page.unroute(filtro);
    }
  };

  await page.goto(`${web}/`);
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.title(), "Tarefas · Pixel");
  assert.deepEqual(await marcados(), ["page", null, "page"]);
  console.log(
    'OK: a lista mostra o controle com "Lista" marcada e "Tarefas" ativo no menu',
  );

  await page.evaluate(() => {
    window.semRecarga = true;
    for (const seletor of [".e-top", ".e-tabs", ".e-footer"])
      document.querySelector(seletor).marcaPersistente = true;
  });
  await busca.fill("a");
  await selecionar("Status", "A fazer");
  await selecionar("Prioridade", "Média");
  const combinadas = seed.tarefas
    .filter(
      (t) =>
        t.titulo.toLocaleLowerCase("pt-BR").includes("a") &&
        t.status === "a-fazer" &&
        t.prioridade === "media",
    )
    .map((t) => t.id)
    .sort();
  assert.ok(
    combinadas.length > 0 &&
      combinadas.length <
        seed.tarefas.filter((t) => t.status === "a-fazer").length,
  );
  assert.deepEqual(await ids(lista), combinadas);
  await trocarSemCarga(linkQuadro, quadro, combinadas);
  assert.equal(await page.title(), "Quadro · Pixel");
  assert.equal(caminho(), "/quadro");
  assert.equal(await lista.count(), 0);
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await ids(quadro), combinadas);
  assert.deepEqual(await marcados(), [null, "page", "page"]);
  assert.match(
    await page.locator(".e-sheet-footer").innerText(),
    new RegExp(`^${combinadas.length} de ${seed.tarefas.length} tarefas$`),
  );
  console.log(
    "OK: lista → quadro preserva busca, status e prioridade, sem recarregar o documento",
  );

  await busca.fill("");
  await selecionar("Status", "Todos");
  await selecionar("Prioridade", "Alta");
  const altas = seed.tarefas
    .filter((t) => t.prioridade === "alta")
    .map((t) => t.id)
    .sort();
  assert.deepEqual(await ids(quadro), altas);
  await trocarSemCarga(linkLista, lista, altas);
  assert.equal(await page.title(), "Tarefas · Pixel");
  assert.equal(caminho(), "/");
  await conferirFiltros("", "Todos", "Alta");
  assert.deepEqual(await ids(lista), altas);
  console.log("OK: quadro → lista preserva os filtros alterados no quadro");

  await page.goBack();
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(await page.title(), "Quadro · Pixel");
  await conferirFiltros("", "Todos", "Alta");
  await page.goForward();
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.title(), "Tarefas · Pixel");
  await conferirFiltros("", "Todos", "Alta");
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  console.log("OK: voltar e avançar do navegador mantêm busca e filtros");

  await busca.focus();
  for (let passo = 0; passo < 6 && (await focado()) !== "Quadro"; passo++)
    await page.keyboard.press("Tab");
  assert.equal(await focado(), "Quadro");
  assert.equal(await focoVisivel(linkQuadro), true);
  await page.keyboard.press("Enter");
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(await page.title(), "Quadro · Pixel");
  assert.equal(caminho(), "/quadro");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-current") === "page" &&
      document.activeElement.textContent === "Quadro",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focado(), "Lista");
  await page.keyboard.press("Enter");
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.title(), "Tarefas · Pixel");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-current") === "page" &&
      document.activeElement.textContent === "Lista",
  );
  console.log(
    "OK: Tab alcança o controle, Enter troca de visão e o foco não volta ao início da página",
  );

  const alvo = seed.tarefas.find((t) => t.prioridade === "alta");
  const detalhe = page.getByRole("dialog", {
    name: "Detalhes da tarefa",
    exact: true,
  });
  for (const [link, regiao, rota, esperado] of [
    [linkLista, lista, "/", ["page", null, "page"]],
    [linkQuadro, quadro, "/quadro", [null, "page", "page"]],
  ]) {
    await link.click();
    await regiao.locator("[data-task-id]").first().waitFor();
    await regiao.getByRole("link", { name: alvo.titulo, exact: true }).click();
    await detalhe.waitFor();
    await detalhe
      .getByRole("heading", { name: alvo.titulo, exact: true })
      .waitFor();
    assert.equal(await page.title(), `${alvo.titulo} · Pixel`);
    assert.deepEqual(await marcados(), esperado, rota);
    await page.keyboard.press("Escape");
    await detalhe.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === rota);
    assert.equal(
      await page.title(),
      `${rota === "/" ? "Tarefas" : "Quadro"} · Pixel`,
    );
    await conferirFiltros("", "Todos", "Alta");
  }
  console.log(
    "OK: a ficha sobre a lista e sobre o quadro mantém a visão marcada e os filtros",
  );

  for (const [rota, esperado] of [
    ["/quadro/", [null, "page", "page"]],
    ["/QUADRO", [null, "page", "page"]],
    ["/?x=1", ["page", null, "page"]],
  ]) {
    await page.goto(`${web}${rota}`);
    await page.locator("[data-task-id]").first().waitFor();
    assert.deepEqual(await marcados(), esperado, rota);
  }
  await page.goto(`${web}/projetos`);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  assert.equal(await visao.count(), 0);
  assert.equal(await menuTarefas.getAttribute("aria-current"), null);
  console.log(
    "OK: barra final e maiúsculas marcam a visão certa; fora das tarefas o controle some",
  );
  const abas = page.getByRole("navigation", { name: "Projetos" });
  await page.goto(`${web}/quadro`);
  await page.locator("[data-task-id]").first().waitFor();
  await abas.getByRole("link", { name: "Todas" }).click();
  await page.waitForURL((url) => url.pathname === "/quadro");
  await abas.getByRole("link").nth(1).click();
  await page.waitForURL((url) => /^\/projetos\/[^/]+$/.test(url.pathname));
  await abas.getByRole("link", { name: "Todas" }).click();
  await page.waitForURL((url) => url.pathname === "/quadro");
  await page.getByRole("link", { name: "Lista", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await abas.getByRole("link").nth(1).click();
  await page.waitForURL((url) => /^\/projetos\/[^/]+$/.test(url.pathname));
  await abas.getByRole("link", { name: "Todas" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  console.log('OK: "Todas" volta para a visão em uso, lista ou quadro');

  for (const rota of ["/", "/quadro"]) {
    await page.goto(`${web}${rota}`);
    await page.locator("[data-task-id]").first().waitFor();
    for (const largura of [1280, 850, 700, 420, 375, 320]) {
      await page.setViewportSize({ width: largura, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${rota} em ${largura} px`,
      );
      const folha = await page.locator(".e-sheet").boundingBox();
      const controle = await visao.boundingBox();
      const cabecalho = await page.locator(".e-top").boundingBox();
      const acao = page
        .locator(".e-top")
        .getByRole("button", { name: "Nova tarefa", exact: true });
      const botao = await acao.boundingBox();
      assert.ok(
        controle.x >= folha.x &&
          controle.x + controle.width <= folha.x + folha.width,
        `${rota} em ${largura} px`,
      );
      assert.ok(
        botao.x >= cabecalho.x &&
          botao.x + botao.width <= cabecalho.x + cabecalho.width,
        `${rota} em ${largura} px`,
      );
      assert.ok(
        botao.y >= cabecalho.y &&
          botao.y + botao.height <= cabecalho.y + cabecalho.height,
        `${rota} em ${largura} px`,
      );
      assert.ok(
        controle.y >= cabecalho.y + cabecalho.height,
        `${rota} em ${largura} px`,
      );
      if (largura <= 650)
        assert.ok(
          botao.width >= 44 && botao.height >= 44,
          `${rota} em ${largura} px`,
        );
      await page.evaluate(() => window.scrollTo(0, 600));
      assert.equal((await page.locator(".e-top").boundingBox()).y, 0);
      assert.equal(
        await acao.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
        true,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      if (largura <= 650)
        for (const link of [linkLista, linkQuadro])
          assert.ok(
            (await link.boundingBox()).height >= 38,
            `${rota} em ${largura} px`,
          );
      if (evidencias)
        await page.screenshot({
          path: join(
            evidencias,
            `visao${rota === "/" ? "-lista" : "-quadro"}-${largura}.png`,
          ),
        });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  console.log(
    "OK: controle dentro da folha e Nova tarefa no header fixo, acessível ao rolar, de 1280 a 320 px",
  );

  const animacao = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  await animacao.clock.install({ time: new Date("2026-11-13T12:00:00Z") });
  await animacao.clock.pauseAt(new Date("2026-11-13T12:00:01Z"));
  await animacao.goto(web);
  await animacao.locator("[data-task-id]").first().waitFor();
  const palavra = animacao.locator(".e-top-palavra");
  const quadroLogo = () =>
    palavra.evaluate((el) => getComputedStyle(el).backgroundPositionX);
  const quadroGato = () =>
    animacao
      .locator(".e-top-gato")
      .evaluate((el) => getComputedStyle(el).backgroundPositionX);
  assert.notEqual(await quadroLogo(), "0px");
  await animacao.clock.fastForward(900);
  assert.equal(await quadroLogo(), "0px");
  const navegarAnimado = async (link, caminho) => {
    await link.dispatchEvent("click");
    await animacao.waitForURL((url) => url.pathname === caminho);
    assert.equal(await quadroLogo(), "-840px", caminho);
    assert.equal(await quadroGato(), "-216px", caminho);
  };
  await navegarAnimado(
    animacao.getByRole("link", { name: "Quadro", exact: true }),
    "/quadro",
  );
  await animacao.clock.fastForward(160);
  assert.equal(await quadroLogo(), "-924px");
  assert.equal(await quadroGato(), "-288px");
  await navegarAnimado(
    animacao.getByRole("link", { name: "Lista", exact: true }),
    "/",
  );
  await animacao.clock.fastForward(900);
  assert.equal(await quadroGato(), "0px");
  const primeira = await animacao
    .locator("[data-task-id]")
    .first()
    .getAttribute("data-task-id");
  await animacao
    .locator(`[data-task-id="${primeira}"] .e-task-title`)
    .dispatchEvent("click");
  await animacao.getByRole("dialog").waitFor();
  await animacao.clock.runFor(100);
  assert.equal(await quadroLogo(), "0px");
  await animacao
    .getByRole("button", { name: "Editar tarefa", exact: true })
    .dispatchEvent("click");
  const responsavel = animacao.getByRole("textbox", { name: /^Responsável/ });
  for (
    let tentativa = 0;
    tentativa < 100 && !(await responsavel.isVisible());
    tentativa++
  )
    await animacao.clock.runFor(50);
  await responsavel.fill("Revalidação confirmada");
  await animacao
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .dispatchEvent("click");
  await animacao
    .getByRole("button", { name: "Editar tarefa", exact: true })
    .waitFor();
  await animacao
    .locator(`[data-task-id="${primeira}"]`)
    .getByText("Revalidação confirmada", { exact: true })
    .waitFor();
  assert.equal(await quadroLogo(), "0px");
  await animacao.clock.runFor(100);
  await animacao.keyboard.press("Escape");
  await animacao.clock.runFor(400);
  await animacao.waitForURL((url) => url.pathname === "/");
  assert.equal(await quadroLogo(), "0px");
  await animacao
    .getByRole("searchbox", { name: "Buscar por título" })
    .fill("a");
  assert.equal(await quadroLogo(), "0px");
  const navPrincipal = animacao.getByRole("navigation", {
    name: "Navegação principal",
  });
  await navegarAnimado(
    navPrincipal.getByRole("link", { name: "Projetos", exact: true }),
    "/projetos",
  );
  await animacao.locator("[data-project-id] h2 a").first().waitFor();
  let consultasProjeto = [];
  animacao.on("request", (request) => {
    if (new URL(request.url()).pathname === "/projetos/1")
      consultasProjeto.push(new URL(request.url()).search);
  });
  await navegarAnimado(
    animacao.locator('[data-project-id="1"] h2 a'),
    "/projetos/1",
  );
  await animacao
    .getByRole("heading", {
      level: 1,
      name: seed.projetos[0].nome,
      exact: true,
    })
    .waitFor();
  assert.ok(
    consultasProjeto.length > 0 &&
      consultasProjeto.every((consulta) => consulta === "?_embed=tarefas"),
  );
  await navegarAnimado(
    animacao.locator('.e-tabs a[href="/projetos/2"]'),
    "/projetos/2",
  );
  await animacao.clock.fastForward(900);
  await animacao.evaluate(() => {
    history.pushState({}, "", "/nao-encontrada");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await animacao
    .getByRole("heading", { name: "Página não encontrada", exact: true })
    .waitFor();
  assert.equal(await quadroLogo(), "-840px");
  assert.equal(await quadroGato(), "-216px");
  await animacao.emulateMedia({ reducedMotion: "reduce" });
  await animacao
    .getByRole("link", { name: "Voltar para tarefas", exact: true })
    .dispatchEvent("click");
  await animacao.waitForURL((url) => url.pathname === "/");
  assert.equal(await quadroLogo(), "0px");
  assert.equal(await quadroGato(), "0px");
  await animacao.emulateMedia({ reducedMotion: "no-preference" });
  const logo = animacao.locator(".e-logo");
  await logo.dispatchEvent("pointerenter", { pointerType: "mouse" });
  assert.equal(await quadroLogo(), "-756px");
  await animacao.clock.fastForward(400);
  assert.equal(await quadroLogo(), "0px");
  await logo.dispatchEvent("pointerleave", { pointerType: "mouse" });
  await logo.focus();
  assert.equal(await quadroLogo(), "-756px");
  await animacao.clock.fastForward(4700);
  await navegarAnimado(
    navPrincipal.getByRole("link", { name: "Projetos", exact: true }),
    "/projetos",
  );
  await animacao.clock.runFor(250);
  assert.equal(
    await quadroGato(),
    "-288px",
    "a piscada agendada não interrompe o gesto da troca",
  );
  await animacao.close();
  console.log(
    "OK: logo e gato animam entrada e troca, reiniciam a troca em curso, respeitam movimento reduzido e não tocam com ficha, gravação, revalidação ou busca; a piscada não interrompe o gesto; projeto usa só embed",
  );

  const menuProjetos = page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Projetos", exact: true });
  await page.goto(`${web}/`);
  await lista.getByRole("article").first().waitFor();
  await menuProjetos.click();
  await page.locator("[data-project-id] h2 a").first().waitFor();
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  const fichaProjeto = page.getByRole("dialog", {
    name: "Novo projeto",
    exact: true,
  });
  await fichaProjeto
    .getByLabel(/^Nome\s*\*?$/)
    .fill("Projeto sem entrada duplicada");
  await fichaProjeto.getByLabel(/^Disciplina\s*\*?$/).fill("Navegação");
  await criarUi(page, () => fichaProjeto.locator("form")).preencherData(
    "Criado em",
    "2026-11-15",
  );
  await fichaProjeto
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.activeElement?.textContent === "Projeto sem entrada duplicada",
  );
  assert.equal(caminho(), "/projetos");
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/");
  await lista.getByRole("article").first().waitFor();
  await page.goForward();
  await page.waitForURL((url) => url.pathname === "/projetos");
  await page.locator('[data-project-id="1"] h2 a').click();
  await page
    .getByRole("heading", {
      level: 1,
      name: seed.projetos[0].nome,
      exact: true,
    })
    .waitFor();
  await page.locator(".e-edit-project-details").click();
  const fichaEdicao = page.getByRole("dialog", {
    name: "Editar projeto",
    exact: true,
  });
  await page.waitForFunction(
    (nome) =>
      [
        ...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input'),
      ].some((campo) => campo.value === nome),
    seed.projetos[0].nome,
  );
  await fichaEdicao
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await fichaEdicao.waitFor({ state: "detached" });
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains("e-edit-project-details"),
  );
  assert.equal(caminho(), "/projetos/1");
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/projetos");
  await page.locator("[data-project-id] h2 a").first().waitFor();
  console.log(
    "OK: depois de criar ou editar um projeto, o primeiro Voltar do navegador sai da página, sem entrada duplicada",
  );

  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto(`${web}/projetos`);
  await page.locator("[data-project-id] h2 a").first().waitFor();
  const rolado = await page.evaluate(() => {
    window.scrollTo(
      0,
      Math.min(900, document.documentElement.scrollHeight - innerHeight),
    );
    return scrollY;
  });
  assert.ok(rolado > 100, `rolagem insuficiente: ${rolado}`);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page
    .locator('[data-project-id="2"] h2 a')
    .evaluate((link) => link.click());
  await page
    .getByRole("heading", {
      level: 1,
      name: seed.projetos[1].nome,
      exact: true,
    })
    .waitFor();
  assert.equal(await page.evaluate(() => scrollY), 0);
  let liberarProjetos;
  const atrasoProjetos = new Promise((resolve) => {
    liberarProjetos = resolve;
  });
  const filtroProjetos = (url) =>
    url.origin === api && url.pathname === "/projetos";
  await page.route(filtroProjetos, async (route) => {
    await atrasoProjetos;
    await route.continue();
  });
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/projetos");
  await page.getByText("Carregando projetos…", { exact: true }).waitFor();
  liberarProjetos();
  await page.locator("[data-project-id] h2 a").first().waitFor();
  await page.waitForFunction((y) => scrollY === y, rolado);
  await page.unroute(filtroProjetos);
  await page.goForward();
  await page
    .getByRole("heading", {
      level: 1,
      name: seed.projetos[1].nome,
      exact: true,
    })
    .waitFor();
  assert.equal(await page.evaluate(() => scrollY), 0);
  await menuProjetos.evaluate((link) => link.click());
  await page.locator("[data-project-id] h2 a").first().waitFor();
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log(
    "OK: a 390 px, Voltar devolve /projetos à rolagem em que estava, mesmo com a lista chegando depois; navegação nova começa no topo",
  );

  await page.goto(`${producao}/`);
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.title(), "Tarefas · Pixel");
  await page.evaluate(() => {
    window.semRecarga = true;
  });
  await busca.fill("a");
  await selecionar("Status", "A fazer");
  await selecionar("Prioridade", "Média");
  await linkQuadro.click();
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(await page.title(), "Quadro · Pixel");
  assert.equal(caminho(), "/quadro");
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.evaluate(() => window.semRecarga), true);
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await ids(quadro), combinadas);
  assert.deepEqual(await marcados(), [null, "page", "page"]);
  await linkLista.click();
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.title(), "Tarefas · Pixel");
  assert.equal(caminho(), "/");
  await conferirFiltros("a", "A fazer", "Média");
  assert.deepEqual(await marcados(), ["page", null, "page"]);
  console.log(
    "OK: no build padrão de produção (BrowserRouter) a troca preserva busca e filtros",
  );

  const consultasProducao = [];
  const registrarConsulta = (request) => {
    const url = new URL(request.url());
    if (url.origin === api && url.pathname === "/projetos/1")
      consultasProducao.push(url.search);
  };
  page.on("request", registrarConsulta);
  await page.goto(`${producao}/projetos/1`);
  await page
    .getByRole("heading", {
      level: 1,
      name: seed.projetos[0].nome,
      exact: true,
    })
    .waitFor();
  assert.equal(caminho(), "/projetos/1");
  assert.equal(new URL(page.url()).hash, "");
  assert.deepEqual(consultasProducao, ["?_embed=tarefas"]);
  page.off("request", registrarConsulta);
  console.log(
    "OK: o build de produção busca o detalhe do projeto com uma única chamada embed",
  );

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(
    ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
      readFile(arquivo, "utf8"),
    ),
  );
  assert.deepEqual(atuais, originais);
  console.log(
    "Cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.",
  );
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
