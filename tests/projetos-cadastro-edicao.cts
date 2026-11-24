const assert = require("node:assert/strict");
const { mkdir, readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { criarUi, focoVisivel, criarEsperas } = require("./ui.cts");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();
const { subir } = apoio;

const raiz = join(__dirname, "..");
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let total = 0;

async function ate(descricao, verificar) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (await verificar()) return;
    await dormir(100);
  }
  throw new Error(`Tempo esgotado: ${descricao}`);
}

async function conferir(nome, executar) {
  await executar();
  total++;
  console.log(`OK: ${nome}`);
}

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedOriginal);
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-projetos-33-" });
  const idsSeed = JSON.stringify(seed.projetos.map((p) => p.id));
  const api = await subir(
    "a API temporária",
    "api/servidor.mjs",
    (porta) => [banco, "--host", "127.0.0.1", "--port", String(porta)],
    process.env,
    "/projetos",
    async (resposta) =>
      JSON.stringify((await resposta.json()).map((p) => p.id)) === idsSeed,
  );
  const origem = await subir(
    "a aplicação",
    "node_modules/vite/bin/vite.js",
    (porta) => ["--host", "127.0.0.1", "--port", String(porta), "--strictPort"],
    { ...process.env, VITE_API_URL: api },
    "/",
    async (resposta) => (await resposta.text()).includes("/src/main.tsx"),
  );
  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const requisicoesApi = [];
  const gravacoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (req) => {
    if (req.url().startsWith(api)) {
      const caminhoReq = new URL(req.url()).pathname;
      requisicoesApi.push(`${req.method()} ${caminhoReq}`);
      if (["POST", "PATCH", "PUT"].includes(req.method())) {
        gravacoes.push({
          metodo: req.method(),
          caminho: caminhoReq,
          dados: req.postDataJSON(),
        });
      }
    }
  });
  const ui = criarUi(page);
  const campo = ui.campo;
  const salvarNovo = () =>
    page.getByRole("button", { name: "Salvar projeto", exact: true });
  const salvarEdicao = () =>
    page.getByRole("button", { name: "Salvar alterações", exact: true });
  const caminho = () => new URL(page.url()).pathname;
  const atalhoCriado = () => ui.atalhoData("Criado em");
  const avisoErroData = () =>
    page.locator(
      ".e-tarefa-avisos p.formulario-tarefa__aviso--erro[role=alert]",
    );
  const idsDescricaoData = async () =>
    ((await atalhoCriado().getAttribute("aria-describedby")) ?? "")
      .split(/\s+/)
      .filter(Boolean);
  const hojeNaPagina = () =>
    page.evaluate(() => {
      const agora = new Date();
      const iso = [
        agora.getFullYear(),
        String(agora.getMonth() + 1).padStart(2, "0"),
        String(agora.getDate()).padStart(2, "0"),
      ].join("-");
      const extensa = new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${iso}T12:00:00`));
      return { iso, extensa };
    });
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));
  async function esperarEdicao(id) {
    const dados = (await lerBanco()).projetos.find((p) => p.id === id);
    await page.locator("form").waitFor();
    await ate(
      `valores do projeto ${id}`,
      async () => (await campo("Nome").inputValue()) === dados.nome,
    );
    return dados;
  }
  async function abrirEdicao(id = "1") {
    await page.goto(`${origem}/projetos/${id}/editar`);
    return esperarEdicao(id);
  }
  async function trocarRota(rota) {
    await page.evaluate((url) => {
      history.pushState({}, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, rota);
  }
  const { assentar, segurar } = criarEsperas(page);

  await conferir(
    "acesso a /projetos/novo pela lista, direto e recarga sem interpretar novo como ID",
    async () => {
      await page.goto(`${origem}/projetos`);
      await page
        .getByRole("link", { name: seed.projetos[0].nome, exact: true })
        .waitFor();
      requisicoesApi.length = 0;
      await page
        .getByRole("button", { name: "Novo projeto", exact: true })
        .click();
      await page.locator("form").waitFor();
      assert.equal(caminho(), "/projetos/novo");
      assert.equal(
        await page
          .getByRole("dialog", { name: "Novo projeto", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Novo projeto", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page.locator(".e-form-modal.e-ficha-compacta").count(),
        1,
      );
      assert.equal(
        await page
          .locator(".e-title-field")
          .getByLabel(/^Nome\s*\*?$/)
          .count(),
        1,
      );
      for (const rotulo of ["Nome", "Disciplina"]) {
        assert.equal(await campo(rotulo).count(), 1, rotulo);
        assert.equal(await campo(rotulo).inputValue(), "", rotulo);
      }
      assert.equal(await campo("Descrição").count(), 0);
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-expanded"),
        "false",
      );
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-label"),
        "Adicionar descrição",
      );
      await ui.abrirDescricao();
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-label"),
        "Ocultar descrição",
      );
      const descricao = page.getByRole("textbox", {
        name: "Descrição",
        exact: true,
      });
      assert.equal(await descricao.count(), 1);
      assert.equal(await descricao.inputValue(), "");
      assert.equal(
        await descricao.getAttribute("placeholder"),
        "Descrição (opcional)",
      );
      assert.equal(
        await campo("Disciplina").getAttribute("placeholder"),
        "Disciplina",
      );
      const hoje = await hojeNaPagina();
      assert.equal(await campo("Criado em").count(), 0);
      assert.equal(await atalhoCriado().count(), 1);
      assert.equal(
        await atalhoCriado().getAttribute("aria-label"),
        `Criado em: ${hoje.extensa}`,
      );
      assert.equal(await ui.valor("Criado em"), hoje.iso);
      assert.equal(await salvarNovo().count(), 1);
      await page.reload();
      await page.locator("form").waitFor();
      assert.ok(
        !requisicoesApi.some((r) => r.includes("/projetos/novo")),
        requisicoesApi.join(", "),
      );
      await page.goto(`${origem}/projetos/1`);
      await page
        .getByRole("heading", { name: seed.projetos[0].nome, exact: true })
        .waitFor();
      assert.equal(await page.locator("form").count(), 0);
    },
  );

  await conferir(
    "validação de campos obrigatórios, associação acessível e foco no primeiro erro",
    async () => {
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      gravacoes.length = 0;
      await campo("Nome").fill("   ");
      await campo("Disciplina").fill("   ");
      await ui.preencherData("Criado em", "");
      assert.equal(
        await atalhoCriado().getAttribute("aria-label"),
        "Criado em",
      );
      await salvarNovo().click();
      assert.equal(gravacoes.length, 0);
      for (const rotulo of ["Nome", "Disciplina"]) {
        assert.equal(
          await campo(rotulo).getAttribute("aria-required"),
          "true",
          rotulo,
        );
      }
      for (const [rotulo, msg] of [
        ["Nome", "Informe o nome do projeto."],
        ["Disciplina", "Informe a disciplina."],
      ]) {
        assert.equal(
          await campo(rotulo).getAttribute("aria-invalid"),
          "true",
          rotulo,
        );
        const descId = await campo(rotulo).getAttribute("aria-describedby");
        assert.ok(descId, rotulo);
        assert.equal(await page.locator(`[id="${descId}"]`).innerText(), msg);
      }
      assert.equal(await atalhoCriado().getAttribute("data-invalido"), "");
      const idAvisoData = await avisoErroData().getAttribute("id");
      assert.ok(idAvisoData);
      assert.ok((await idsDescricaoData()).includes(idAvisoData));
      assert.equal(
        await avisoErroData().innerText(),
        "Informe a data de criação.",
      );
      await ate("foco no primeiro campo inválido", async () =>
        campo("Nome").evaluate((el) => el === document.activeElement),
      );
      assert.equal(await ui.obrigatorio("Criado em"), true);
      const entradaData = await ui.abrirData("Criado em");
      assert.equal(await entradaData.getAttribute("aria-invalid"), "true");
      const idFormulario = await page.locator("form").getAttribute("id");
      assert.ok(idFormulario);
      assert.equal(await entradaData.getAttribute("form"), idFormulario);
      await ui.fecharData("Criado em");
    },
  );

  async function preencherProjeto(dados) {
    await campo("Nome").fill(dados.nome);
    await ui.abrirDescricao();
    await campo("Descrição").fill(dados.descricao);
    await campo("Disciplina").fill(dados.disciplina);
    await ui.preencherData("Criado em", dados.criadoEm);
  }
  const focoNaTela = () =>
    page.evaluate(() => {
      const caixa = document.activeElement?.getBoundingClientRect();
      return Boolean(
        caixa &&
        caixa.width > 1 &&
        caixa.height > 1 &&
        caixa.top >= 0 &&
        caixa.bottom <= innerHeight,
      );
    });
  const projetosComNome = async (nome) =>
    (await lerBanco()).projetos.filter((p) => p.nome === nome);

  await conferir(
    "data de criação com ano de mais de quatro dígitos é recusada no cadastro e na edição",
    async () => {
      const anoLongo = "20265-12-20";
      const invalida = "Informe uma data válida.";
      async function conferirRecusa() {
        await avisoErroData().getByText(invalida, { exact: true }).waitFor();
        assert.equal(gravacoes.length, 0);
        assert.equal(await atalhoCriado().getAttribute("data-invalido"), "");
        const idAviso = await avisoErroData().getAttribute("id");
        assert.ok(idAviso);
        assert.ok((await idsDescricaoData()).includes(idAviso));
        assert.equal(await avisoErroData().innerText(), invalida);
        await ate("foco no atalho da data inválida", async () =>
          atalhoCriado().evaluate((el) => el === document.activeElement),
        );
      }
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await preencherProjeto({
        nome: "Projeto com data inválida",
        descricao: "",
        disciplina: "Redes",
        criadoEm: anoLongo,
      });
      gravacoes.length = 0;
      await salvarNovo().click();
      await conferirRecusa();
      assert.equal(caminho(), "/projetos/novo");
      const idAvisoAnterior = await avisoErroData().getAttribute("id");
      await ui.preencherData("Criado em", "2026-12-20");
      assert.equal(await page.getByText(invalida, { exact: true }).count(), 0);
      assert.equal(await avisoErroData().count(), 0);
      assert.equal(await atalhoCriado().getAttribute("data-invalido"), null);
      assert.ok(!(await idsDescricaoData()).includes(idAvisoAnterior));

      await page.route(`${api}/projetos/1`, (route) =>
        route.request().method() === "GET"
          ? route.fulfill({ json: { ...seed.projetos[0], criadoEm: anoLongo } })
          : route.continue(),
      );
      await abrirEdicao("1");
      assert.equal(await ui.valor("Criado em"), anoLongo);
      gravacoes.length = 0;
      await salvarEdicao().click();
      await conferirRecusa();
      assert.equal(caminho(), "/projetos/1/editar");
      await page.unrouteAll();
    },
  );

  await conferir(
    "POST real grava sem id e sem espaços nas pontas, retorna à lista e disponibiliza em tarefas",
    async () => {
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      const novo = {
        nome: "Portal Acadêmico Pixel",
        descricao: "Cadastro completo do Marco 3",
        disciplina: "Desenvolvimento Frontend",
        criadoEm: "2026-10-18",
      };
      await preencherProjeto({
        ...novo,
        nome: `  ${novo.nome}  `,
        disciplina: ` ${novo.disciplina}   `,
      });
      gravacoes.length = 0;
      await salvarNovo().click();
      await ate(
        "retorno à lista de projetos",
        async () => caminho() === "/projetos",
      );
      await page.getByRole("link", { name: novo.nome, exact: true }).waitFor();
      assert.deepEqual(gravacoes, [
        { metodo: "POST", caminho: "/projetos", dados: novo },
      ]);
      const db = await lerBanco();
      assert.equal(db.projetos.length, seed.projetos.length + 1);
      const criado = db.projetos.find((p) => p.nome === novo.nome);
      assert.ok(
        criado && typeof criado.id === "string" && criado.id.length > 0,
      );
      assert.deepEqual(criado, { id: criado.id, ...novo });
      await ate("foco no título do cartão criado", () =>
        page.evaluate(
          (id) =>
            document.activeElement ===
            document.querySelector(`[data-project-id="${id}"] h2 a`),
          criado.id,
        ),
      );
      assert.equal(await focoNaTela(), true);
      await page.goto(`${origem}/tarefas/nova`);
      await page.locator("form").waitFor();
      await ate("novo projeto no seletor de tarefas", async () =>
        (await criarUi(page).opcoes("Projeto")).some(
          (o) => o.texto === novo.nome && o.value === criado.id,
        ),
      );
      await criarUi(page).seletor("Projeto").click();
      await page
        .getByRole("option", { name: novo.nome, exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
    },
  );

  await conferir(
    "falha 500 ou de conexão no POST mantém os dados e a nova tentativa cria um único projeto",
    async () => {
      const quantidade = (await lerBanco()).projetos.length;
      const dados = {
        nome: "Projeto após falha de envio",
        descricao: "Sem gravação na falha",
        disciplina: "Sistemas Operacionais",
        criadoEm: "2026-10-19",
      };
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await preencherProjeto(dados);
      await page.route(`${api}/projetos`, (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 500, json: {} })
          : route.continue(),
      );
      gravacoes.length = 0;
      await salvarNovo().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar o projeto" })
        .waitFor();
      assert.equal(caminho(), "/projetos/novo");
      assert.equal(await campo("Nome").inputValue(), dados.nome);
      assert.equal((await lerBanco()).projetos.length, quantidade);
      await page.unrouteAll();

      await page.route(`${api}/projetos`, (route) =>
        route.request().method() === "POST"
          ? route.abort("connectionrefused")
          : route.continue(),
      );
      await ate("envio liberado após erro 500", () => salvarNovo().isEnabled());
      await salvarNovo().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar o projeto" })
        .waitFor();
      assert.equal((await lerBanco()).projetos.length, quantidade);
      assert.equal(await campo("Disciplina").inputValue(), dados.disciplina);
      await page.unrouteAll();

      await ate("envio liberado após falha de rede", () =>
        salvarNovo().isEnabled(),
      );
      await salvarNovo().click();
      await ate(
        "retorno à lista após nova tentativa",
        async () => caminho() === "/projetos",
      );
      await page.getByRole("link", { name: dados.nome, exact: true }).waitFor();
      assert.equal(gravacoes.filter((g) => g.metodo === "POST").length, 3);
      assert.equal((await lerBanco()).projetos.length, quantidade + 1);
      assert.equal((await projetosComNome(dados.nome)).length, 1);
    },
  );

  await conferir(
    "nova tentativa após falha de POST não sobrescreve projeto com mesmos campos criado em outra aba",
    async () => {
      const quantidade = (await lerBanco()).projetos.length;
      const dadosIniciais = {
        nome: "Projeto Concorrente",
        descricao: "Mesmos campos iniciais",
        disciplina: "Banco de Dados",
        criadoEm: "2026-10-20",
      };
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await preencherProjeto(dadosIniciais);
      await page.route(`${api}/projetos`, (route) =>
        route.request().method() === "POST"
          ? route.abort("connectionrefused")
          : route.continue(),
      );
      gravacoes.length = 0;
      await salvarNovo().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar o projeto" })
        .waitFor();
      await page.unrouteAll();

      const respOutraAba = await fetch(`${api}/projetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosIniciais),
      });
      assert.equal(respOutraAba.ok, true);
      const criadoOutraAba = await respOutraAba.json();

      const dadosRenomeados = {
        ...dadosIniciais,
        nome: "Projeto Renomeado na Primeira Aba",
      };
      await campo("Nome").fill(dadosRenomeados.nome);
      await ate("envio liberado após falha", () => salvarNovo().isEnabled());
      await salvarNovo().click();
      await ate(
        "retorno à lista após criar novo projeto",
        async () => caminho() === "/projetos",
      );
      await page
        .getByRole("link", { name: dadosRenomeados.nome, exact: true })
        .waitFor();
      await page
        .getByRole("link", { name: dadosIniciais.nome, exact: true })
        .waitFor();

      assert.equal(gravacoes.filter((g) => g.metodo === "PATCH").length, 0);
      const db = await lerBanco();
      assert.equal(db.projetos.length, quantidade + 2);
      assert.deepEqual(
        db.projetos.find((p) => p.id === criadoOutraAba.id),
        criadoOutraAba,
      );
      assert.equal((await projetosComNome(dadosRenomeados.nome)).length, 1);
    },
  );

  await conferir(
    "POST pendente no cadastro bloqueia duplicidade e ignora resposta após saída pelo histórico",
    async () => {
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      const dados = {
        nome: "Projeto com envio lento",
        descricao: "Teste de bloqueio",
        disciplina: "Redes",
        criadoEm: "2026-10-21",
      };
      await preencherProjeto(dados);
      const envioNovo = await segurar(`${api}/projetos`, { metodo: "POST" });
      gravacoes.length = 0;
      await salvarNovo().click();
      await ate("botão bloqueado no POST", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await page.evaluate(() => document.querySelector("form").requestSubmit());
      await assentar();
      assert.equal(caminho(), "/projetos/novo");
      assert.equal(gravacoes.filter((g) => g.metodo === "POST").length, 1);
      await envioNovo.liberar();
      await ate("lista após POST lento", async () => caminho() === "/projetos");
      assert.equal(gravacoes.filter((g) => g.metodo === "POST").length, 1);
      await page.unrouteAll();

      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await preencherProjeto({ ...dados, nome: "Projeto abandonado no menu" });
      const envioAbandonado = await segurar(`${api}/projetos`, {
        metodo: "POST",
        responder: (route) =>
          route.fulfill({ status: 201, json: { id: "simulado", ...dados } }),
      });
      await salvarNovo().click();
      await ate("envio em curso", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await trocarRota("/");
      await page
        .getByRole("heading", { name: "Tarefas", exact: true })
        .waitFor();
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      assert.equal(
        await page.locator("form").count(),
        0,
        "o formulário foi desmontado antes da resposta tardia",
      );
      await envioAbandonado.liberar();
      assert.equal(caminho(), "/");
      await page.unrouteAll();
    },
  );

  await conferir(
    "cancelar e fechar na criação retornam à lista sem gravar",
    async () => {
      const antes = await lerBanco();
      gravacoes.length = 0;
      for (const acao of ["Cancelar", "Fechar novo projeto"]) {
        await page.goto(`${origem}/projetos/novo`);
        await page.locator("form").waitFor();
        await campo("Nome").fill("Projeto descartado");
        await page.getByRole("button", { name: acao, exact: true }).click();
        await ate(`lista após ${acao}`, async () => caminho() === "/projetos");
      }
      assert.equal(gravacoes.length, 0);
      assert.deepEqual(await lerBanco(), antes);
    },
  );

  await conferir(
    "data de hoje no cadastro não conta como alteração: clique fora fecha; com alteração, mantém a ficha",
    async () => {
      const fora = async () => {
        await ate(
          "ficha posicionada",
          async () =>
            (await page.locator(".e-form-modal").boundingBox())?.x > 200,
        );
        await page.mouse.click(100, 450);
      };
      gravacoes.length = 0;
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      assert.equal(await ui.valor("Criado em"), (await hojeNaPagina()).iso);
      await fora();
      await ate(
        "lista após clique fora sem alteração",
        async () => caminho() === "/projetos",
      );
      await page.locator("form").waitFor({ state: "detached" });
      await page.goto(`${origem}/projetos/novo`);
      await page.locator("form").waitFor();
      await campo("Nome").fill("Projeto em rascunho");
      await fora();
      await assentar();
      assert.equal(caminho(), "/projetos/novo");
      assert.equal(await campo("Nome").inputValue(), "Projeto em rascunho");
      assert.equal(gravacoes.length, 0);
    },
  );

  await conferir(
    "botão de edição, acesso direto e recarga em /projetos/:id/editar com dados atuais",
    async () => {
      await page.goto(`${origem}/projetos/1`);
      await page
        .getByRole("heading", { name: seed.projetos[0].nome, exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Editar projeto", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Editar projeto", exact: true })
        .waitFor();
      assert.equal(caminho(), "/projetos/1/editar");
      const projeto = await esperarEdicao("1");
      assert.equal(await page.title(), `Editar: ${projeto.nome} · Pixel`);
      assert.ok(projeto.descricao);
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-expanded"),
        "true",
      );
      assert.equal(await campo("Descrição").count(), 1);
      const campos = {
        Nome: "nome",
        Descrição: "descricao",
        Disciplina: "disciplina",
        "Criado em": "criadoEm",
      };
      for (const [rotulo, atributo] of Object.entries(campos)) {
        assert.equal(await ui.valor(rotulo), projeto[atributo], rotulo);
      }
      await page.reload();
      await esperarEdicao("1");
      assert.equal(await ui.valor("Criado em"), projeto.criadoEm);
    },
  );

  await conferir(
    "PATCH real mantém ID e tarefas vinculadas, persiste campos e retorna ao detalhe",
    async () => {
      await abrirEdicao("1");
      const dados = {
        nome: "Gerenciador Pixel Atualizado",
        descricao: "Descrição revisada do projeto\ncom segunda linha",
        disciplina: "Engenharia de Software",
        criadoEm: "2026-10-15",
      };
      await campo("Nome").fill(`   ${dados.nome} `);
      await campo("Descrição").fill(dados.descricao);
      await campo("Disciplina").fill(`  ${dados.disciplina}  `);
      await ui.preencherData("Criado em", dados.criadoEm);
      gravacoes.length = 0;
      await salvarEdicao().click();
      await ate(
        "retorno ao detalhe do projeto",
        async () => caminho() === "/projetos/1",
      );
      await page
        .getByRole("heading", { level: 1, name: dados.nome, exact: true })
        .waitFor();
      assert.deepEqual(gravacoes, [
        { metodo: "PATCH", caminho: "/projetos/1", dados },
      ]);
      const db = await lerBanco();
      assert.deepEqual(
        db.projetos.find((p) => p.id === "1"),
        { id: "1", ...dados },
      );
      assert.equal(db.tarefas.filter((t) => t.projetoId === "1").length, 4);
      await page.reload();
      await page
        .getByRole("heading", { level: 1, name: dados.nome, exact: true })
        .waitFor();
      assert.equal(await page.locator("article").count(), 4);
    },
  );

  await conferir(
    "editar pela página do projeto devolve o foco a Editar projeto; pela lista, o foco vai ao título",
    async () => {
      await page.goto(`${origem}/projetos/1`);
      await page
        .getByRole("button", { name: "Editar projeto", exact: true })
        .click();
      await esperarEdicao("1");
      const descricao = "Descrição revisada pela página do projeto";
      await campo("Descrição").fill(descricao);
      gravacoes.length = 0;
      await salvarEdicao().click();
      await ate(
        "retorno ao detalhe do projeto",
        async () => caminho() === "/projetos/1",
      );
      await page
        .locator("#project-details")
        .getByText(descricao, { exact: true })
        .waitFor();
      assert.deepEqual(gravacoes, [
        { metodo: "PATCH", caminho: "/projetos/1", dados: { descricao } },
      ]);
      await ate("foco em Editar projeto", () =>
        page.evaluate(
          () =>
            document.activeElement?.matches(".e-edit-project-details") ?? false,
        ),
      );
      assert.equal(await focoNaTela(), true);
      await page.goto(`${origem}/projetos`);
      await page.locator('[data-project-id="2"] .e-edit-project').click();
      await esperarEdicao("2");
      gravacoes.length = 0;
      await salvarEdicao().click();
      await ate(
        "retorno ao detalhe do projeto",
        async () => caminho() === "/projetos/2",
      );
      assert.deepEqual(gravacoes, [
        { metodo: "PATCH", caminho: "/projetos/2", dados: {} },
      ]);
      await ate("foco no título visível do projeto", () =>
        page.evaluate(
          () => document.activeElement === document.querySelector("main h1"),
        ),
      );
      assert.equal(await focoNaTela(), true);
    },
  );

  await conferir(
    "cancelar e fechar na edição retornam ao detalhe sem gravar",
    async () => {
      const antes = await lerBanco();
      gravacoes.length = 0;
      for (const acao of ["Cancelar", "Fechar editar projeto"]) {
        await abrirEdicao("1");
        await campo("Nome").fill("Alteração cancelada");
        await page.getByRole("button", { name: acao, exact: true }).click();
        await ate(
          `detalhe após ${acao}`,
          async () => caminho() === "/projetos/1",
        );
      }
      assert.equal(gravacoes.length, 0);
      assert.deepEqual(await lerBanco(), antes);
    },
  );

  await conferir(
    "ID inexistente encerra carregamento e não abre formulário",
    async () => {
      await page.goto(`${origem}/projetos/999/editar`);
      await page
        .getByRole("dialog")
        .getByRole("alert")
        .filter({ hasText: "Este projeto não existe ou foi removido." })
        .waitFor();
      assert.equal(await page.title(), "Projeto não encontrado · Pixel");
      assert.equal(await page.locator("form").count(), 0);
      assert.equal(await page.getByRole("status").count(), 0);
    },
  );

  await conferir(
    "falha de leitura informa erro e encerra carregamento",
    async () => {
      await page.route(`${api}/projetos/1`, (route) =>
        route.abort("connectionrefused"),
      );
      await page.goto(`${origem}/projetos/1/editar`);
      await page
        .getByRole("dialog")
        .getByRole("alert")
        .filter({ hasText: "Não foi possível carregar o projeto" })
        .waitFor();
      assert.equal(await page.title(), "Editar projeto · Pixel");
      assert.equal(await page.locator("form").count(), 0);
      assert.equal(await page.getByRole("status").count(), 0);
      await page.unrouteAll();
    },
  );

  await conferir(
    "trocar ID reinicia campos e ignora leitura atrasada",
    async () => {
      await abrirEdicao("1");
      await campo("Nome").fill("Rascunho do projeto anterior");
      await trocarRota("/projetos/2/editar");
      await esperarEdicao("2");
      assert.equal(await campo("Nome").inputValue(), seed.projetos[1].nome);
      const leitura = await segurar(`${api}/projetos/1`, {
        responder: (route) => route.fulfill({ json: seed.projetos[0] }),
      });
      await trocarRota("/projetos/1/editar");
      await ate(
        "leitura atrasada iniciada",
        async () => leitura.pedidos.length > 0,
      );
      assert.equal(await page.locator("form").count(), 0);
      await trocarRota("/projetos/2/editar");
      await esperarEdicao("2");
      await leitura.liberar();
      assert.equal(await campo("Nome").inputValue(), seed.projetos[1].nome);
      await page.unrouteAll();
    },
  );

  await conferir(
    "erro na gravação preserva os dados, bloqueia duplicação e ignora resposta após saída",
    async () => {
      await abrirEdicao("2");
      await campo("Nome").fill("Projeto preservado após falha");
      await page.route(`${api}/projetos/2`, (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: 500, json: {} })
          : route.continue(),
      );
      await salvarEdicao().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar o projeto" })
        .waitFor();
      assert.equal(caminho(), "/projetos/2/editar");
      assert.equal(
        await campo("Nome").inputValue(),
        "Projeto preservado após falha",
      );
      await ate("envio liberado após erro", () => salvarEdicao().isEnabled());
      await page.unrouteAll();
      const envioEdicao = await segurar(`${api}/projetos/2`, {
        metodo: "PATCH",
      });
      gravacoes.length = 0;
      await salvarEdicao().click();
      await ate("botão bloqueado", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await page.evaluate(() => document.querySelector("form").requestSubmit());
      await assentar();
      assert.equal(caminho(), "/projetos/2/editar");
      assert.equal(gravacoes.length, 1);
      await envioEdicao.liberar();
      await ate(
        "detalhe após nova tentativa",
        async () => caminho() === "/projetos/2",
      );
      assert.equal(gravacoes.length, 1);
      await page
        .getByRole("heading", {
          name: "Projeto preservado após falha",
          exact: true,
        })
        .waitFor();
      await page.unrouteAll();

      await abrirEdicao("1");
      const projeto1 = (await lerBanco()).projetos.find((p) => p.id === "1");
      const envioSaida = await segurar(`${api}/projetos/1`, {
        metodo: "PATCH",
        responder: (route) => route.fulfill({ json: projeto1 }),
      });
      await salvarEdicao().click();
      await ate("envio em curso", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await trocarRota("/");
      await page
        .getByRole("heading", { name: "Tarefas", exact: true })
        .waitFor();
      await page.locator('[role="dialog"]').waitFor({ state: "detached" });
      assert.equal(
        await page.locator("form").count(),
        0,
        "o formulário foi desmontado antes da resposta tardia",
      );
      await envioSaida.liberar();
      assert.equal(caminho(), "/");
      await page.unrouteAll();
    },
  );

  await conferir(
    "formulário em 320px, foco visível, envio por teclado e bancos preservados",
    async () => {
      await page.setViewportSize({ width: 320, height: 800 });
      await abrirEdicao("1");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await campo("Nome").focus();
      assert.equal(await focoVisivel(campo("Nome")), true);
      await page.keyboard.press("Tab");
      assert.equal(
        await campo("Disciplina").evaluate(
          (el) => el === document.activeElement,
        ),
        true,
      );
      assert.equal(await focoVisivel(campo("Disciplina")), true);
      await campo("Descrição").focus();
      assert.equal(
        await campo("Descrição").evaluate(
          (el) => el === document.activeElement,
        ),
        true,
      );
      assert.equal(await focoVisivel(campo("Descrição")), true);
      if (process.env.PROJETOS_EVIDENCIAS) {
        await mkdir(process.env.PROJETOS_EVIDENCIAS, { recursive: true });
        await page.screenshot({
          path: join(process.env.PROJETOS_EVIDENCIAS, "editar-projeto-320.png"),
          fullPage: true,
        });
      }
      await campo("Nome").focus();
      await page.keyboard.press("Enter");
      await ate("envio pelo teclado", async () => caminho() === "/projetos/1");
      assert.deepEqual(errosPagina, []);
      assert.equal(
        await readFile(join(raiz, "db.json"), "utf8"),
        bancoOriginal,
      );
      assert.equal(
        await readFile(join(raiz, "db.seed.json"), "utf8"),
        seedOriginal,
      );
    },
  );

  await conferir(
    "avisa quando outra pessoa ocupa a décima vaga e esconde a ação de criar",
    async () => {
      const criarNaApi = (nome) =>
        fetch(`${api}/projetos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...seed.projetos[0], nome }),
        });
      const { projetos } = await lerBanco();
      for (let quantidade = projetos.length; quantidade < 9; quantidade++) {
        assert.equal(
          (await criarNaApi(`Projeto ${quantidade + 1}`)).status,
          201,
        );
      }
      await page.goto(`${origem}/projetos`);
      const novoProjeto = page.getByRole("button", {
        name: "Novo projeto",
        exact: true,
      });
      await novoProjeto.click();
      await campo("Nome").fill("Rascunho na última vaga");
      await campo("Disciplina").fill("Desenvolvimento Frontend");
      assert.equal((await criarNaApi("Décimo projeto")).status, 201);
      await salvarNovo().click();
      const aviso = "Limite de 10 projetos atingido.";
      await page.getByRole("alert").filter({ hasText: aviso }).waitFor();
      assert.equal(await campo("Nome").inputValue(), "Rascunho na última vaga");
      assert.equal((await lerBanco()).projetos.length, 10);

      await page.goto(`${origem}/projetos`);
      await page.getByRole("status").filter({ hasText: aviso }).waitFor();
      assert.equal(await novoProjeto.count(), 0);
      assert.equal(await page.locator("[data-project-id]").count(), 10);
    },
  );

  console.log(`${total} cenários aprovados; bancos originais preservados.`);
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
