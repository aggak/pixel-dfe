const assert = require("node:assert/strict");
const { mkdir, readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { comTextos, criarUi, focoVisivel, criarEsperas } = require("./ui.cts");
const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

const repo = join(__dirname, "..");
const evidencias = process.env.NOVA_TAREFA_EVIDENCIAS || "";
const ROTULOS = [
  "Projeto",
  "Título",
  "Descrição",
  "Status",
  "Prioridade",
  "Responsável",
];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let browser;
let apiUrl = "";
let origem = "";
async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}
async function ate(descricao, verificar, tentativas = 150) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const valor = await verificar();
      if (valor) return valor;
    } catch {}
    await dormir(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${descricao}`);
}
async function executar() {
  const bancoRealAntes = await readFile(join(repo, "db.json"), "utf8");
  const seedAntes = await readFile(join(repo, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedAntes);
  const { banco: caminhoDb } = await apoio.criarBanco({
    prefixo: "pixel-nova-tarefa-",
  });
  ({ api: apiUrl, web: origem } = await apoio.subirAmbiente({
    banco: caminhoDb,
    rotaApi: "/projetos",
    tentativas: 150,
  }));
  try {
    browser = await apoio.abrirNavegador();
  } catch (erro) {
    throw new Error(
      `Não foi possível abrir o navegador (${process.env.TEST_BROWSER || "chrome"}): ${erro.message}`,
    );
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const errosConsole = [];
  const requisicoesApi = [];
  const posts = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !msg.text().includes("Failed to load resource")
    )
      errosConsole.push(msg.text());
  });
  page.on("request", (req) => {
    if (req.url().startsWith(apiUrl))
      requisicoesApi.push(`${req.method()} ${new URL(req.url()).pathname}`);
    if (req.method() === "POST" && req.url() === `${apiUrl}/tarefas`) {
      try {
        posts.push(JSON.parse(req.postData() || "{}"));
      } catch {
        posts.push({});
      }
    }
  });
  const ui = criarUi(page);
  const campo = ui.campo;
  const controle = (rotulo) =>
    ["Projeto", "Status", "Prioridade"].includes(rotulo)
      ? ui.seletor(rotulo)
      : campo(rotulo);
  const aguardarProjetos = (descricao = "projetos carregados no formulário") =>
    ate(descricao, () => ui.projetosCarregados(seed.projetos.length));
  const botaoSalvar = () =>
    page.getByRole("button", { name: "Salvar", exact: true });
  const botaoEnvio = () => page.locator('form button[type="submit"]');
  const caminho = () => new URL(page.url());
  const lerDb = async () => JSON.parse(await readFile(caminhoDb, "utf8"));
  async function abrir(rota) {
    await page.goto(`${origem}${rota}`);
    await page.locator("form").waitFor();
    await aguardarProjetos();
  }
  const preencher = (dados) =>
    ui.preencherTarefa(comTextos(dados, seed.projetos));
  const { assentar, segurar } = criarEsperas(page);
  const base = {
    projetoId: "1",
    titulo: "Tarefa da suíte nova tarefa",
    descricao: "Criada pela suíte da página nova",
    status: "em-andamento",
    prioridade: "alta",
    responsavel: "Bruno",
    prazo: "2027-03-15",
  };
  await conferir(
    "abertura direta e recarga em /tarefas/nova sem GET /tarefas/nova na API",
    async () => {
      requisicoesApi.length = 0;
      await abrir("/tarefas/nova");
      assert.equal(
        await page
          .getByRole("dialog", { name: "Nova tarefa", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Nova tarefa", exact: true })
          .count(),
        1,
      );
      assert.equal(await campo("Descrição").count(), 0);
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-expanded"),
        "false",
      );
      await ui.abrirDescricao();
      for (const rotulo of ROTULOS)
        assert.equal(await controle(rotulo).count(), 1, rotulo);
      for (const rotulo of ["Projeto", "Título", "Responsável"])
        assert.equal(await ui.obrigatorio(rotulo), true, rotulo);
      assert.equal(await ui.atalhoPrazo().getAttribute("aria-expanded"), "false");
      const entradaPrazo = await ui.abrirPrazo();
      assert.equal(await entradaPrazo.getAttribute("aria-required"), "true");
      await ui.fecharPrazo();
      assert.equal(await ui.valor("Projeto"), "");
      assert.equal(await botaoSalvar().count(), 1);
      await page.reload();
      await page.locator("form").waitFor();
      await aguardarProjetos("projetos após recarga");
      assert.equal(
        await page
          .getByRole("heading", { name: "Nova tarefa", exact: true })
          .count(),
        1,
      );
      assert.ok(
        !requisicoesApi.some((linha) => linha.includes("/tarefas/nova")),
        requisicoesApi.join(","),
      );
      if (evidencias) {
        await mkdir(evidencias, { recursive: true });
        await page.screenshot({
          path: join(evidencias, "nova-tarefa.png"),
          fullPage: true,
        });
      }
    },
  );
  await conferir("/tarefas/1 continua sendo o detalhe da tarefa", async () => {
    await page.goto(`${origem}/tarefas/1`);
    await page
      .getByRole("heading", { name: "Detalhes da tarefa", exact: true })
      .waitFor();
    await page
      .getByRole("dialog", { name: "Detalhes da tarefa", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: seed.tarefas[0].titulo, exact: true })
      .waitFor();
    assert.equal(await page.locator("form").count(), 0);
  });
  await conferir(
    "botão Nova tarefa na lista abre o cadastro sem projeto preselecionado",
    async () => {
      await page.goto(`${origem}/`);
      await page
        .getByRole("link", { name: seed.tarefas[0].titulo, exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Nova tarefa", exact: true })
        .click();
      await page.locator("form").waitFor();
      assert.equal(caminho().pathname, "/tarefas/nova");
      assert.equal(caminho().search, "");
      await aguardarProjetos();
      assert.equal(await ui.valor("Projeto"), "");
    },
  );
  await conferir(
    "ações nos projetos 1 e 2 preselecionam o projeto de origem",
    async () => {
      for (const projeto of seed.projetos) {
        await page.goto(`${origem}/projetos/${projeto.id}`);
        await page
          .getByRole("heading", { name: projeto.nome, exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Nova tarefa", exact: true })
          .click();
        await page.locator("form").waitFor();
        assert.equal(
          caminho().pathname + caminho().search,
          `/tarefas/nova?projetoId=${encodeURIComponent(String(projeto.id))}`,
        );
        await ate(
          `projeto ${projeto.id} preselecionado`,
          async () => (await ui.valor("Projeto")) === String(projeto.id),
        );
        assert.ok(
          (await ui.seletor("Projeto").innerText()).includes(projeto.nome),
        );
        assert.equal(
          caminho().searchParams.get("projetoId"),
          String(projeto.id),
        );
      }
    },
  );
  await conferir(
    "mudança da query na mesma página atualiza o contexto",
    async () => {
      await abrir("/tarefas/nova?projetoId=1");
      assert.equal(await ui.valor("Projeto"), "1");
      await page.evaluate(() => {
        history.pushState({}, "", "/tarefas/nova?projetoId=2");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await ate(
        "contexto trocado para o projeto 2",
        async () => (await ui.valor("Projeto")) === "2",
      );
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await ate(
        "retorno ao projeto 2",
        async () => caminho().pathname === "/projetos/2",
      );
    },
  );
  await conferir(
    "POST real sem id persiste no arquivo e volta para a lista",
    async () => {
      const dados = { ...base, titulo: "Tarefa persistida pela suíte" };
      posts.length = 0;
      await abrir("/tarefas/nova");
      await preencher(dados);
      await botaoSalvar().click();
      await ate(
        "retorno à lista após criar",
        async () => caminho().pathname === "/",
      );
      await page
        .getByRole("link", { name: dados.titulo, exact: true })
        .waitFor();
      assert.equal(posts.length, 1);
      assert.ok(!("id" in posts[0]), "payload não pode conter id");
      assert.deepEqual(posts[0], dados);
      const gravada = await ate(
        "tarefa no arquivo temporário",
        async () =>
          (await lerDb()).tarefas.find((t) => t.titulo === dados.titulo) ||
          null,
      );
      assert.equal(typeof gravada.id, "string");
      assert.deepEqual(
        {
          projetoId: gravada.projetoId,
          titulo: gravada.titulo,
          descricao: gravada.descricao,
          status: gravada.status,
          prioridade: gravada.prioridade,
          responsavel: gravada.responsavel,
          prazo: gravada.prazo,
        },
        dados,
      );
    },
  );
  await conferir(
    "título e responsável são gravados sem espaços nas pontas",
    async () => {
      posts.length = 0;
      await abrir("/tarefas/nova");
      await preencher({
        ...base,
        titulo: "   Tarefa com espaços da suíte   ",
        responsavel: "  Ana  ",
      });
      await botaoSalvar().click();
      await ate(
        "retorno à lista após criar com espaços",
        async () => caminho().pathname === "/",
      );
      assert.equal(posts.length, 1);
      assert.equal(posts[0].titulo, "Tarefa com espaços da suíte");
      assert.equal(posts[0].responsavel, "Ana");
      await page
        .getByRole("link", { name: "Tarefa com espaços da suíte", exact: true })
        .waitFor();
    },
  );
  await conferir("falha 500 no POST mantém dados e página", async () => {
    await page.route(`${apiUrl}/tarefas`, async (route) =>
      route.request().method() !== "POST"
        ? route.continue()
        : route.fulfill({ status: 500, json: {} }),
    );
    try {
      const dados = { ...base, titulo: "Tarefa que não deve ser perdida" };
      await abrir("/tarefas/nova");
      await preencher(dados);
      await botaoSalvar().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar. Tente novamente." })
        .waitFor();
      assert.equal(caminho().pathname, "/tarefas/nova");
      assert.equal(await campo("Título").inputValue(), dados.titulo);
      assert.equal(await ui.valor("Descrição"), dados.descricao);
      assert.equal(await campo("Responsável").inputValue(), dados.responsavel);
      for (const [rotulo, atributo] of [
        ["Projeto", "projetoId"],
        ["Status", "status"],
        ["Prioridade", "prioridade"],
      ])
        assert.equal(await ui.valor(rotulo), dados[atributo], rotulo);
      assert.equal(await (await ui.abrirPrazo()).inputValue(), dados.prazo);
      await ui.fecharPrazo();
      await ate("botão reabilitado após a falha", () =>
        botaoEnvio().isEnabled(),
      );
    } finally {
      await page.unrouteAll();
    }
  });
  await conferir(
    "POST pendente bloqueia duplicidade e não navega antes da resposta",
    async () => {
      const envio = await segurar(`${apiUrl}/tarefas`, { metodo: "POST" });
      try {
        posts.length = 0;
        await abrir("/tarefas/nova");
        await preencher({ ...base, titulo: "Tarefa com envio pendente" });
        await botaoSalvar().click();
        await ate("envio em curso", () => botaoEnvio().isDisabled());
        assert.equal(caminho().pathname, "/tarefas/nova");
        await page.evaluate(() =>
          document.querySelector("form")?.requestSubmit(),
        );
        await assentar();
        assert.equal(posts.length, 1);
        assert.equal(caminho().pathname, "/tarefas/nova");
        await envio.liberar();
        await ate(
          "lista após a resposta",
          async () => caminho().pathname === "/",
        );
        assert.equal(posts.length, 1);
      } finally {
        await page.unrouteAll();
      }
    },
  );
  await conferir(
    "sair pelo histórico durante POST retardado não redireciona ao chegar a resposta",
    async () => {
      const envio = await segurar(`${apiUrl}/tarefas`, { metodo: "POST" });
      try {
        await abrir("/tarefas/nova");
        await preencher({ ...base, titulo: "Tarefa abandonada no menu" });
        await botaoSalvar().click();
        await ate("envio em curso", () => botaoEnvio().isDisabled());
        await page.evaluate(() => {
          history.pushState({}, "", "/projetos");
          dispatchEvent(new PopStateEvent("popstate"));
        });
        await page
          .getByRole("heading", { name: "Projetos", exact: true })
          .waitFor();
        await page.locator('[role="dialog"]').waitFor({ state: "detached" });
        assert.equal(
          await page.locator("form").count(),
          0,
          "o formulário foi desmontado antes da resposta tardia",
        );
        await envio.liberar();
        assert.equal(caminho().pathname, "/projetos");
      } finally {
        await page.unrouteAll();
      }
    },
  );
  await conferir(
    "cancelar e fechar respeitam o contexto e a lista é o padrão",
    async () => {
      await abrir("/tarefas/nova?projetoId=1");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await ate(
        "retorno ao projeto 1",
        async () => caminho().pathname === "/projetos/1",
      );
      await page
        .getByRole("heading", { name: seed.projetos[0].nome, exact: true })
        .waitFor();
      await abrir("/tarefas/nova?projetoId=2");
      await page
        .getByRole("button", { name: "Fechar nova tarefa", exact: true })
        .click();
      await ate(
        "retorno ao projeto 2",
        async () => caminho().pathname === "/projetos/2",
      );
      await page
        .getByRole("heading", { name: seed.projetos[1].nome, exact: true })
        .waitFor();
      await abrir("/tarefas/nova");
      await page
        .getByRole("button", { name: "Fechar nova tarefa", exact: true })
        .click();
      await ate(
        "lista de tarefas pelo fechar",
        async () => caminho().pathname === "/",
      );
      await abrir("/tarefas/nova");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await ate("lista de tarefas", async () => caminho().pathname === "/");
    },
  );
  await conferir(
    "clique fora sobre um cartão: com rascunho a ficha fica aberta com o texto; sem rascunho fecha; Escape e Voltar continuam fechando",
    async () => {
      const abrirPelaLista = async () => {
        await page
          .getByRole("button", { name: "Nova tarefa", exact: true })
          .click();
        await page.locator("form").waitFor();
        await aguardarProjetos();
        await ate(
          "ficha aberta",
          async () =>
            (await page.locator(".e-form-modal").boundingBox())?.x > 0,
        );
      };
      await page.goto(`${origem}/`);
      const cartao = page.getByRole("link", {
        name: seed.tarefas[0].titulo,
        exact: true,
      });
      await cartao.waitFor();
      const caixa = await cartao.boundingBox();
      const ponto = { x: caixa.x + 8, y: caixa.y + caixa.height / 2 };
      await abrirPelaLista();
      assert.ok(
        ponto.x < (await page.locator(".e-form-modal").boundingBox()).x,
        "o ponto do cartão fica fora da ficha",
      );
      await page.mouse.click(ponto.x, ponto.y);
      await ate(
        "sem rascunho, clique fora fecha",
        async () => caminho().pathname === "/",
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await abrirPelaLista();
      await campo("Título").fill("x");
      await campo("Título").fill("");
      await page.mouse.click(ponto.x, ponto.y);
      await ate(
        "de volta aos valores iniciais, clique fora fecha",
        async () => caminho().pathname === "/",
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await abrirPelaLista();
      await campo("Título").fill("Rascunho que não pode sumir");
      await ui.abrirDescricao();
      await campo("Descrição").fill("Parágrafo longo digitado");
      await page.mouse.click(ponto.x, ponto.y);
      await assentar();
      assert.equal(
        await page.locator(".e-form-overlay[data-exiting]").count(),
        0,
      );
      assert.equal(caminho().pathname, "/tarefas/nova");
      assert.equal(
        await page
          .getByRole("dialog", { name: "Nova tarefa", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await campo("Título").inputValue(),
        "Rascunho que não pode sumir",
      );
      assert.equal(
        await campo("Descrição").inputValue(),
        "Parágrafo longo digitado",
      );
      assert.equal(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest('[role="dialog"]')),
        ),
        true,
      );
      await page.keyboard.press("Escape");
      await ate(
        "Escape fecha com rascunho",
        async () => caminho().pathname === "/",
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await abrirPelaLista();
      await campo("Título").fill("Rascunho e Voltar");
      await page.goBack();
      await ate(
        "Voltar fecha com rascunho",
        async () => caminho().pathname === "/",
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
    },
  );
  await conferir(
    "sucesso com contexto de projeto volta para a lista do projeto",
    async () => {
      const dados = {
        ...base,
        projetoId: "2",
        titulo: "Tarefa contextual da suíte",
      };
      await abrir("/tarefas/nova?projetoId=2");
      assert.equal(await ui.valor("Projeto"), "2");
      await preencher(dados);
      await botaoSalvar().click();
      await ate(
        "projeto após sucesso contextual",
        async () => caminho().pathname === "/projetos/2",
      );
      assert.equal(caminho().pathname + caminho().search, "/projetos/2");
      await page
        .getByRole("link", { name: dados.titulo, exact: true })
        .waitFor();
    },
  );
  await conferir(
    "criada na página de um projeto mas atribuída a outro: aviso com link para o projeto dela",
    async () => {
      const dados = {
        ...base,
        projetoId: "1",
        titulo: "Tarefa criada em outro projeto da suíte",
      };
      await abrir("/tarefas/nova?projetoId=2");
      await preencher(dados);
      await botaoSalvar().click();
      await ate(
        "projeto de origem após sucesso",
        async () => caminho().pathname === "/projetos/2",
      );
      const aviso = page.locator(".e-hidden-notice");
      await aviso.waitFor();
      assert.equal(
        await aviso.locator("span").innerText(),
        "Tarefa criada em outro projeto.",
      );
      assert.equal(
        await page
          .getByRole("link", { name: dados.titulo, exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator('[aria-live="polite"]')
          .filter({ hasText: "Tarefa criada em outro projeto." })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("status")
          .filter({ hasText: "outro projeto" })
          .count(),
        0,
      );
      await ate("foco no link do aviso", () =>
        page.evaluate(
          () =>
            document.activeElement?.closest(".e-hidden-notice") !== null &&
            document.activeElement?.textContent === "Ver o projeto",
        ),
      );
      await aviso.getByRole("link", { name: "Ver o projeto" }).click();
      await ate(
        "projeto da tarefa",
        async () => caminho().pathname === "/projetos/1",
      );
      await page
        .getByRole("link", { name: dados.titulo, exact: true })
        .waitFor();
      assert.equal(await page.locator(".e-hidden-notice").count(), 0);
      await abrir("/tarefas/nova?projetoId=2");
      await preencher({
        ...base,
        projetoId: "2",
        titulo: "Tarefa do mesmo projeto da suíte",
      });
      await botaoSalvar().click();
      await page
        .getByRole("link", {
          name: "Tarefa do mesmo projeto da suíte",
          exact: true,
        })
        .waitFor();
      assert.equal(await page.locator(".e-hidden-notice").count(), 0);
    },
  );
  await conferir(
    "projeto inexistente na query bloqueia até escolher um válido",
    async () => {
      posts.length = 0;
      await abrir("/tarefas/nova?projetoId=999");
      assert.equal(await ui.valor("Projeto"), "999");
      assert.ok(
        (await ui.seletor("Projeto").innerText()).includes(
          "Projeto não encontrado",
        ),
      );
      await page
        .getByText(
          "Projeto não encontrado. Selecione outro.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await botaoEnvio().isDisabled(), true);
      await preencher({ ...base, projetoId: "" });
      await page.evaluate(() =>
        document.querySelector("form")?.requestSubmit(),
      );
      await assentar();
      assert.equal(posts.length, 0);
      assert.equal(caminho().pathname, "/tarefas/nova");
      await ui.escolher("Projeto", seed.projetos[0].nome);
      assert.equal(await ui.valor("Projeto"), "1");
      await ate("salvar liberado com projeto válido", () =>
        botaoEnvio().isEnabled(),
      );
    },
  );
  await conferir(
    "largura de 320px sem overflow e navegação por teclado",
    async () => {
      await page.setViewportSize({ width: 320, height: 700 });
      await abrir("/tarefas/nova");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.body.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await ui.abrirDescricao();
      assert.deepEqual(
        await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("input, textarea")]
            .filter(
              (el) =>
                el.offsetWidth > 1 &&
                parseFloat(getComputedStyle(el).fontSize) < 16,
            )
            .map((el) => el.getAttribute("name") || el.getAttribute("type")),
        ),
        [],
        "campos de texto com menos de 16 px ampliam a página no iOS",
      );
      await campo("Responsável").click();
      assert.equal(
        await page.evaluate(
          () => document.activeElement && document.activeElement.id,
        ),
        await campo("Responsável").evaluate((el) => el.id),
      );
      let alcancouBotao = false;
      for (let i = 0; i < 8 && !alcancouBotao; i++) {
        await page.keyboard.press("Tab");
        alcancouBotao = await page.evaluate(
          () =>
            document.activeElement instanceof HTMLButtonElement &&
            document.activeElement.closest("form") !== null,
        );
      }
      assert.equal(
        alcancouBotao,
        true,
        "Tab deve alcançar um botão do formulário",
      );
      if (evidencias)
        await page.screenshot({
          path: join(evidencias, "nova-tarefa-320.png"),
          fullPage: true,
        });
      await page.setViewportSize({ width: 1280, height: 900 });
    },
  );
  await conferir(
    "foco e Escape após falha de envio: o foco permanece na ficha e Escape retorna à origem",
    async () => {
      const antes = await lerDb();
      posts.length = 0;
      const dados = { ...base, titulo: "Tarefa com falha e foco recuperado" };
      const envio = await segurar(`${apiUrl}/tarefas`, {
        metodo: "POST",
        responder: (route) => route.fulfill({ status: 500, json: {} }),
      });
      try {
        await page.goto(`${origem}/`);
        await page
          .getByRole("link", { name: seed.tarefas[0].titulo, exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Nova tarefa", exact: true })
          .click();
        await page.locator("form").waitFor();
        await aguardarProjetos();
        await botaoSalvar().click();
        for (const mensagem of [
          "Informe o título.",
          "Selecione um projeto.",
          "Informe o responsável.",
          "Informe o prazo.",
        ])
          await page.getByText(mensagem, { exact: true }).waitFor();
        assert.equal(posts.length, 0);
        const cor = (alvo) => alvo.evaluate((el) => getComputedStyle(el).color);
        const corErro = await cor(
          page.getByText("Selecione um projeto.", { exact: true }),
        );
        const tamanho = (texto) =>
          page
            .getByText(texto, { exact: true })
            .evaluate((el) => getComputedStyle(el).fontSize);
        assert.equal(
          await tamanho("Informe o título."),
          await tamanho("Informe o responsável."),
        );
        assert.equal(
          await cor(
            page.locator(".e-tarefa-responsavel .e-uicon").last(),
          ),
          corErro,
        );
        const iconeProjeto = ui.seletor("Projeto").locator(".e-uicon").first();
        await ate("ícones de projeto e prazo na cor de erro", async () =>
          (await cor(iconeProjeto)) === corErro &&
          (await cor(ui.atalhoPrazo())) === corErro,
        );
        await ui.seletor("Projeto").hover();
        await ate("cor de erro mantida sob o ponteiro", async () =>
          (await cor(iconeProjeto)) === corErro,
        );
        await ui.escolher("Status", "Em andamento");
        await campo("Título").fill(dados.titulo);
        await ui.abrirDescricao();
        await campo("Descrição").fill(dados.descricao);
        await campo("Responsável").fill(dados.responsavel);
        await ui.preencherPrazo(dados.prazo);
        await ui.escolher("Projeto", seed.projetos[0].nome);
        await botaoSalvar().click();
        await ate("envio em curso", () => botaoEnvio().isDisabled());
        await envio.liberar();
        await page
          .getByRole("alert")
          .filter({ hasText: "Não foi possível salvar. Tente novamente." })
          .waitFor();
        await ate("botão reabilitado após a falha", () =>
          botaoEnvio().isEnabled(),
        );
        await ate("foco recuperado dentro da ficha", () =>
          page.evaluate(() => {
            const ativo = document.activeElement;
            return Boolean(
              ativo &&
              ativo !== document.body &&
              ativo.closest('[role="dialog"]'),
            );
          }),
        );
        assert.equal(posts.length, 1);
        assert.equal(await campo("Título").inputValue(), dados.titulo);
        await page.keyboard.press("Escape");
        await ate("lista após Escape", async () => caminho().pathname === "/");
        await ate("foco devolvido à origem", () =>
          page.evaluate(
            () =>
              document.activeElement?.getAttribute("data-action") ===
              "new-task",
          ),
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Nova tarefa", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        assert.deepEqual((await lerDb()).tarefas, antes.tarefas);
      } finally {
        await page.unrouteAll();
      }
    },
  );
  await conferir(
    "depois de criar com Enter, o foco vai ao título do cartão novo, à vista; escondido, ao aviso",
    async () => {
      const focoNaTela = () =>
        page.evaluate(() => {
          const ativo = document.activeElement;
          const caixa = ativo?.getBoundingClientRect();
          return {
            texto: ativo?.textContent,
            cartao: ativo?.matches("[data-task-id] .e-task-title") ?? false,
            visivel: Boolean(
              caixa &&
              caixa.width > 1 &&
              caixa.height > 1 &&
              caixa.top >= 0 &&
              caixa.bottom <= innerHeight,
            ),
          };
        });
      const dados = { ...base, titulo: "Tarefa nova com foco no cartão" };
      await page.goto(`${origem}/`);
      await page
        .getByRole("link", { name: seed.tarefas[0].titulo, exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Nova tarefa", exact: true })
        .press("Enter");
      await page.locator("form").waitFor();
      await aguardarProjetos();
      await preencher(dados);
      await (await ui.abrirPrazo()).press("Enter");
      await ate(
        "foco no cartão criado",
        async () => (await focoNaTela()).texto === dados.titulo,
      );
      assert.deepEqual(await focoNaTela(), {
        texto: dados.titulo,
        cartao: true,
        visivel: true,
      });
      const escondida = { ...base, titulo: "Tarefa nova escondida pela busca" };
      await page.locator(".e-task-search input").fill(seed.tarefas[0].titulo);
      await page.locator("[data-task-id]").first().waitFor();
      await page
        .getByRole("button", { name: "Nova tarefa", exact: true })
        .click();
      await page.locator("form").waitFor();
      await aguardarProjetos();
      await preencher(escondida);
      await botaoSalvar().click();
      await page
        .getByText("Tarefa criada, mas escondida pela busca ou pelos filtros.")
        .waitFor();
      await ate("foco no aviso de tarefa escondida", () =>
        page.evaluate(
          () =>
            document.activeElement?.closest(".e-hidden-notice") !== null &&
            document.activeElement?.textContent === "Limpar busca e filtros",
        ),
      );
      await page.keyboard.press("Enter");
      await ate("busca limpa com foco na busca", () =>
        page.evaluate(
          () => document.activeElement?.closest(".e-task-search") !== null,
        ),
      );
    },
  );
  await conferir(
    "depois de criar, o primeiro Voltar do navegador sai da lista, como se a ficha nunca tivesse sido aberta",
    async () => {
      const dados = { ...base, titulo: "Tarefa criada sem entrada duplicada" };
      await page.goto(`${origem}/projetos`);
      await page.locator("[data-project-id] h2 a").first().waitFor();
      await page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Tarefas", exact: true })
        .click();
      await page
        .getByRole("link", { name: seed.tarefas[0].titulo, exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Nova tarefa", exact: true })
        .click();
      await page.locator("form").waitFor();
      await aguardarProjetos();
      await preencher(dados);
      await botaoSalvar().click();
      await ate("foco no cartão criado", () =>
        page.evaluate(
          (titulo) =>
            document.activeElement?.matches("[data-task-id] .e-task-title") ===
              true && document.activeElement.textContent === titulo,
          dados.titulo,
        ),
      );
      assert.equal(caminho().pathname, "/");
      await page.goBack();
      await ate(
        "Projetos no primeiro Voltar",
        async () => caminho().pathname === "/projetos",
      );
      await page
        .getByRole("heading", { name: "Projetos", exact: true })
        .waitFor();
      await page.goForward();
      await ate("lista ao avançar", async () => caminho().pathname === "/");
      await page
        .getByRole("link", { name: dados.titulo, exact: true })
        .waitFor();
    },
  );
  await conferir(
    "sem projetos, Criar projeto abre a ficha sem recarregar; com projetos, o link não aparece",
    async () => {
      await abrir("/tarefas/nova");
      assert.equal(
        await page
          .getByRole("link", { name: "Criar projeto", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByText(
            "Nenhum projeto cadastrado.",
          )
          .count(),
        0,
      );
      await page.route(`${apiUrl}/projetos`, (route) =>
        route.fulfill({ json: [] }),
      );
      try {
        await page.goto(`${origem}/tarefas/nova`);
        await page.locator("form").waitFor();
        const aviso = page.getByRole("status").filter({
          hasText:
            "Nenhum projeto cadastrado.",
        });
        await aviso.waitFor();
        const link = aviso.getByRole("link", {
          name: "Criar projeto",
          exact: true,
        });
        assert.equal(await link.getAttribute("href"), "/projetos/novo");
        assert.equal(await botaoEnvio().isDisabled(), true);
        await page.setViewportSize({ width: 375, height: 800 });
        const alvo = await link.evaluate((el) => {
          const caixa = el.getBoundingClientRect();
          return { largura: caixa.width, altura: caixa.height };
        });
        assert.ok(
          alvo.largura >= 44 && alvo.altura >= 44,
          `alvo ${alvo.largura}×${alvo.altura}`,
        );
        await link.focus();
        assert.equal(await focoVisivel(link), true);
        await page.setViewportSize({ width: 1280, height: 900 });
        const historico = await page.evaluate(() => history.length);
        await page.evaluate(() => {
          window.__semRecarga = true;
        });
        const popup = page.context().waitForEvent("page", { timeout: 5000 });
        await link.click({ modifiers: ["Control"] });
        const aba = await popup;
        await ate(
          "Ctrl+clique abre /projetos/novo em outra aba",
          async () => new URL(aba.url()).pathname === "/projetos/novo",
        );
        assert.equal(new URL(page.url()).pathname, "/tarefas/nova");
        await aba.close();
        await link.click();
        await ate(
          "ficha de novo projeto na mesma aba",
          async () => caminho().pathname === "/projetos/novo",
        );
        assert.equal(await page.evaluate(() => window.__semRecarga), true);
        assert.equal(await page.evaluate(() => history.length), historico);
        await page
          .getByRole("dialog", { name: "Novo projeto", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        await ate(
          "cancelar o novo projeto segue para a lista de projetos",
          async () => caminho().pathname === "/projetos",
        );
      } finally {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.unrouteAll();
      }
    },
  );
  await conferir(
    "sem erros de página ou console e bancos reais intactos",
    async () => {
      assert.deepEqual(errosPagina, []);
      assert.deepEqual(errosConsole, []);
      assert.equal(
        await readFile(join(repo, "db.json"), "utf8"),
        bancoRealAntes,
      );
      assert.equal(
        await readFile(join(repo, "db.seed.json"), "utf8"),
        seedAntes,
      );
    },
  );
  console.log(`${total} cenários aprovados; banco real intacto.`);
}
executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
