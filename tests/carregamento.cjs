// Estados de carregamento da issue #43 com
// requisições controladas no navegador.
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const { criarApoio } = require("./apoio.cjs");
const apoio = criarApoio();

const raiz = join(__dirname, "..");
let browser;

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-carregamento-" });
  const { api, web } = await apoio.subirAmbiente({ banco });

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));

  async function conferirRota(
    nome,
    caminho,
    selecionarRequisicao,
    selecionarIndicador,
  ) {
    let iniciou;
    let liberar;
    const requisicao = new Promise((resolve) => {
      iniciou = resolve;
    });
    const bloqueio = new Promise((resolve) => {
      liberar = resolve;
    });
    const interceptar = async (rota) => {
      if (
        rota.request().method() === "GET" &&
        selecionarRequisicao(new URL(rota.request().url()))
      ) {
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
      assert.equal(
        await indicador.isVisible(),
        true,
        `${nome}: indicador oculto`,
      );
      liberar();
      await indicador.waitFor({ state: "detached" });
      console.log(`OK: ${nome}`);
    } finally {
      liberar();
      await page.unroute(`${api}/**`, interceptar);
    }
  }

  const status = (texto) => page.getByRole("status").filter({ hasText: texto });
  const statusFicha = (texto) =>
    page.getByRole("dialog").getByRole("status").filter({ hasText: texto });
  await conferirRota(
    "lista mostra e retira carregamento das tarefas",
    "/",
    (url) => url.pathname === "/tarefas",
    () => status("Carregando tarefas"),
  );
  await conferirRota(
    "quadro mostra e retira carregamento das tarefas",
    "/quadro",
    (url) => url.pathname === "/tarefas",
    () => status("Carregando tarefas"),
  );
  await conferirRota(
    "lista mostra e retira carregamento dos projetos nas abas",
    "/",
    (url) => url.pathname === "/projetos",
    () =>
      page.getByRole("navigation", { name: "Projetos" }).getByRole("status"),
  );
  await conferirRota(
    "lista de projetos mostra e retira carregamento",
    "/projetos",
    (url) => url.pathname === "/projetos",
    () => status("Carregando projetos"),
  );
  await conferirRota(
    "página do projeto mostra e retira carregamento",
    "/projetos/1",
    (url) => url.pathname === "/projetos/1",
    () => page.locator(".e-content").getByRole("status"),
  );
  await conferirRota(
    "detalhes da tarefa mostram e retiram carregamento",
    "/tarefas/1",
    (url) => url.pathname === "/tarefas/1",
    () => statusFicha("Carregando tarefa"),
  );
  await conferirRota(
    "nome do projeto na ficha mostra e retira carregamento",
    "/tarefas/1",
    (url) => url.pathname === "/projetos",
    () => page.getByRole("dialog").locator(".e-read-project [role=status]"),
  );
  await conferirRota(
    "edição da tarefa mostra e retira carregamento",
    "/tarefas/1/editar",
    (url) => url.pathname === "/tarefas/1",
    () => statusFicha("Carregando tarefa"),
  );
  await conferirRota(
    "nova tarefa mostra e retira carregamento dos projetos",
    "/tarefas/nova",
    (url) => url.pathname === "/projetos",
    () => statusFicha("Carregando projetos"),
  );
  await conferirRota(
    "edição do projeto mostra e retira carregamento",
    "/projetos/1/editar",
    (url) => url.pathname === "/projetos/1",
    () => statusFicha("Carregando projeto"),
  );

  async function reter(caminho, transformar) {
    let iniciou;
    let liberar;
    let concluir;
    const conclusao = new Promise((resolve) => {
      concluir = resolve;
    });
    const requisicao = new Promise((resolve) => {
      iniciou = resolve;
    });
    const bloqueio = new Promise((resolve) => {
      liberar = resolve;
    });
    const interceptar = async (rota) => {
      if (
        rota.request().method() === "GET" &&
        new URL(rota.request().url()).pathname === caminho
      ) {
        iniciou();
        await bloqueio;
        if (transformar) {
          try {
            const resposta = await rota.fetch();
            await rota.fulfill({
              response: resposta,
              json: transformar(await resposta.json()),
            });
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
    return {
      requisicao,
      liberar: async () => {
        liberar();
        if (transformar) await conclusao;
        await page.unroute(`${api}/**`, interceptar);
      },
    };
  }

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [caminho, consulta, anuncio, nome, semDescricao = false] of [
      ["/tarefas/1/editar", "/tarefas/1", "Carregando tarefa", "Editar tarefa"],
      [
        "/tarefas/1/editar",
        "/tarefas/1",
        "Carregando tarefa",
        "Editar tarefa",
        true,
      ],
      [
        "/projetos/1/editar",
        "/projetos/1",
        "Carregando projeto",
        "Editar projeto",
      ],
      ["/tarefas/nova", "/projetos", "Carregando projetos", "Nova tarefa"],
      ["/projetos/novo", "/projetos", "", "Novo projeto"],
    ]) {
      const consultaPendente = await reter(
        consulta,
        semDescricao ? (dados) => ({ ...dados, descricao: "" }) : undefined,
      );
      try {
        await page.goto(`${web}${caminho}`);
        const ficha = page.getByRole("dialog", { name: nome, exact: true });
        await ficha.waitFor();
        if (anuncio) await statusFicha(anuncio).waitFor();
        else await ficha.locator("form").waitFor();
        await page.evaluate(() => document.fonts.ready);
        const cabecalho = ficha.locator(".e-form-header");
        const topo = await cabecalho.evaluate(
          (el) => el.getBoundingClientRect().top,
        );
        const fechar = ficha.getByRole("button", {
          name: `Fechar ${nome.toLocaleLowerCase("pt-BR")}`,
          exact: true,
        });
        await fechar.focus();
        await consultaPendente.liberar();
        await ficha.locator("form").waitFor();
        if (anuncio) await statusFicha(anuncio).waitFor({ state: "detached" });
        if (caminho === "/tarefas/1/editar") {
          await page.waitForFunction(
            () =>
              ![...document.querySelectorAll('[role="status"]')].some((el) =>
                el.textContent.includes("Carregando projetos"),
              ),
          );
        }
        const limite =
          width >= 650
            ? 1
            : caminho === "/tarefas/1/editar"
              ? 54
              : caminho === "/tarefas/nova"
                ? 22
                : 1;
        assert.ok(
          Math.abs(
            (await cabecalho.evaluate((el) => el.getBoundingClientRect().top)) -
              topo,
          ) < limite,
          `${caminho} em ${width}px: deslocamento deve ficar abaixo de ${limite}px`,
        );
        assert.equal(
          await ficha
            .locator(".e-ficha-loading-tarefa,.e-ficha-loading-projeto")
            .count(),
          0,
          "formulário pronto não mantém a reserva de carregamento",
        );
        if (width < 650 && (semDescricao || caminho === "/tarefas/nova")) {
          assert.ok(
            (await ficha.boundingBox()).height < 500,
            "tarefa sem descrição mantém a altura natural, sem vão até o rodapé",
          );
        }
        assert.equal(await fechar.isVisible(), true);
        assert.equal(
          await ficha.locator(":focus").count(),
          1,
          "foco permanece dentro da ficha após carregar",
        );
        if (width < 650) {
          const caixa = await fechar.boundingBox();
          assert.ok(
            caixa.width >= 44 && caixa.height >= 44,
            "fechar mantém alvo de toque móvel",
          );
        }
      } finally {
        await consultaPendente.liberar();
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log(
    "OK: reserva só nas edições carregando, resíduo limitado com/sem descrição e formulários prontos na altura natural em 320, 375 e 1280px",
  );

  const andamento = await reter("/tarefas");
  await page.goto(`${web}/projetos`);
  await andamento.requisicao;
  await page.locator(".e-project-card").first().waitFor();
  const cartoes = await page.locator(".e-project-card").count();
  assert.equal(
    await page
      .locator(".e-project-card .e-proj-foot")
      .filter({ hasText: "Carregando andamento…" })
      .count(),
    cartoes,
  );
  assert.equal(
    await page
      .locator(".e-project-card .e-proj-foot .e-proj-bar-vazia")
      .count(),
    cartoes,
  );
  assert.equal(
    await page.locator(".e-project-card [role=status]").count(),
    0,
    "cada cartão não deve anunciar o carregamento",
  );
  assert.deepEqual(await page.getByRole("status").allTextContents(), [
    "Carregando o andamento dos projetos…",
  ]);
  const alturaCarregando = await page
    .locator(".e-project-card")
    .first()
    .evaluate((cartao) => cartao.getBoundingClientRect().height);
  await andamento.liberar();
  await status("Carregando o andamento").waitFor({ state: "detached" });
  await page
    .locator(".e-project-card .e-proj-bar:not(.e-proj-bar-vazia)")
    .first()
    .waitFor();
  assert.equal(await page.getByText("Carregando andamento…").count(), 0);
  assert.equal(
    await page
      .locator(".e-project-card")
      .first()
      .evaluate((cartao) => cartao.getBoundingClientRect().height),
    alturaCarregando,
  );
  console.log(
    "OK: andamento dos cartões de projeto mostra um único anúncio de carregamento",
  );

  await page.route(`${api}/tarefas`, (rota) =>
    rota.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto(`${web}/projetos`);
  await page.getByText("O andamento dos projetos não carregou.").waitFor();
  assert.equal(await page.getByText("Carregando andamento…").count(), 0);
  assert.equal(await status("Carregando o andamento").count(), 0);
  await page.unroute(`${api}/tarefas`);
  console.log(
    "OK: falha do andamento retira a indicação de carregamento dos cartões",
  );

  const projeto = await reter("/projetos/1");
  await page.goto(`${web}/projetos/1`);
  await projeto.requisicao;
  await page.locator(".e-content").getByRole("status").waitFor();
  const detalhes = page.getByRole("button", { name: "Detalhes do projeto" });
  assert.equal(
    await detalhes.isDisabled(),
    true,
    "detalhes do projeto deve ficar desabilitado enquanto carrega",
  );
  const topoCarregando = await page
    .locator(".e-content")
    .evaluate((conteudo) => conteudo.getBoundingClientRect().top);
  await projeto.liberar();
  await page.locator(".e-list").waitFor();
  assert.equal(await detalhes.isEnabled(), true);
  assert.equal(
    await page
      .locator(".e-content")
      .evaluate((conteudo) => conteudo.getBoundingClientRect().top),
    topoCarregando,
    "a faixa de detalhes não deve empurrar o conteúdo",
  );
  await detalhes.click();
  await page.locator("#project-details").waitFor();
  console.log(
    "OK: faixa de detalhes do projeto reservada desde o carregamento, sem salto",
  );

  for (const [rota, resposta] of [
    ["/projetos/1", 500],
    ["/projetos/999", 404],
  ]) {
    await page.route(`${api}${rota}?*`, (r) =>
      r.fulfill({ status: resposta, body: "{}" }),
    );
    await page.goto(`${web}${rota}`);
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Detalhes do projeto" }).count(),
      0,
      `${rota}: erro sem faixa de detalhes`,
    );
    await page.unroute(`${api}${rota}?*`);
  }
  console.log(
    "OK: erro e projeto inexistente continuam sem a faixa de detalhes",
  );

  await page.route(`${api}/projetos`, (rota) =>
    rota.fulfill({ status: 500, body: "{}" }),
  );
  await page.goto(`${web}/projetos`);
  await page.getByRole("alert").waitFor();
  assert.equal(await status("Carregando projetos").count(), 0);
  await page.unroute(`${api}/projetos`);
  console.log(
    "OK: erro da API retira o indicador e mostra a mensagem de falha",
  );

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(
    await readFile(join(raiz, "db.seed.json"), "utf8"),
    seedOriginal,
  );
  console.log("OK: sem erros JavaScript e bancos locais preservados");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
