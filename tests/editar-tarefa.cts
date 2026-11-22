const assert = require("node:assert/strict");
const { mkdir, readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { comTextos, criarUi, focoVisivel, criarEsperas } = require("./ui.cts");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

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
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-editar-tarefa-" });
  const { api, web: origem } = await apoio.subirAmbiente({ banco });
  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const gravacoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (req) => {
    if (
      req.url().startsWith(api) &&
      ["POST", "PATCH", "PUT"].includes(req.method())
    ) {
      gravacoes.push({
        metodo: req.method(),
        caminho: new URL(req.url()).pathname,
        dados: req.postDataJSON(),
      });
    }
  });
  const ui = criarUi(page);
  const campo = ui.campo;
  const salvar = () =>
    page.getByRole("button", { name: "Salvar alterações", exact: true });
  const caminho = () => new URL(page.url()).pathname;
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));
  async function esperarFormulario(id) {
    const dados = (await lerBanco()).tarefas.find((t) => t.id === id);
    await page.locator("form").waitFor();
    await ate(
      `valores da tarefa ${id}`,
      async () => (await campo("Título").inputValue()) === dados.titulo,
    );
    await ate("projetos carregados", () =>
      ui.projetosCarregados(seed.projetos.length),
    );
    return dados;
  }
  async function abrir(id = "1") {
    await page.goto(`${origem}/tarefas/${id}/editar`);
    return esperarFormulario(id);
  }
  async function trocarRota(rota) {
    await page.evaluate((url) => {
      history.pushState({}, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, rota);
  }
  const { assentar, segurar } = criarEsperas(page);

  await conferir(
    "botão de edição, acesso direto e recarga com todos os campos preenchidos",
    async () => {
      await page.goto(`${origem}/tarefas/1`);
      await page
        .getByRole("dialog", { name: "Detalhes da tarefa", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Editar tarefa", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Editar tarefa", exact: true })
        .waitFor();
      assert.equal(caminho(), "/tarefas/1/editar");
      const tarefa = await esperarFormulario("1");
      assert.equal(await page.title(), `Editar: ${tarefa.titulo} · Pixel`);
      const campos = {
        Projeto: "projetoId",
        Título: "titulo",
        Descrição: "descricao",
        Status: "status",
        Prioridade: "prioridade",
        Responsável: "responsavel",
        Prazo: "prazo",
      };
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-expanded"),
        "true",
      );
      for (const [rotulo, atributo] of Object.entries(campos))
        assert.equal(await ui.valor(rotulo), tarefa[atributo], rotulo);
      await ui.fecharDescricao();
      await ui.abrirDescricao();
      assert.equal(await campo("Descrição").inputValue(), tarefa.descricao);
      await page.reload();
      await esperarFormulario("1");
      assert.equal(await ui.valor("Prazo"), tarefa.prazo);
      await page.goto(`${origem}/`);
      await page
        .getByRole("link", { name: tarefa.titulo, exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: `Ações de ${tarefa.titulo}`, exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Editar tarefa", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Editar tarefa", exact: true })
        .waitFor();
      assert.equal(caminho(), "/tarefas/1/editar");
      await esperarFormulario("1");
    },
  );

  await conferir(
    "PATCH real mantém ID e quantidade, persiste os sete campos e retorna ao detalhe",
    async () => {
      await abrir();
      const dados = {
        projetoId: "2",
        titulo: "Tarefa editada na integração",
        descricao: "Descrição atualizada\ncom segunda linha",
        status: "em-revisao",
        prioridade: "baixa",
        responsavel: "Euclides",
        prazo: "2026-10-20",
      };
      const textos = comTextos(dados, seed.projetos);
      for (const [rotulo, texto] of [
        ["Projeto", textos.nomeProjeto],
        ["Status", textos.nomeStatus],
        ["Prioridade", textos.nomePrioridade],
      ])
        await ui.escolher(rotulo, texto);
      await ui.abrirDescricao();
      for (const [rotulo, valor] of [
        ["Título", dados.titulo],
        ["Descrição", dados.descricao],
        ["Responsável", dados.responsavel],
      ])
        await campo(rotulo).fill(valor);
      await ui.preencherPrazo(dados.prazo);
      assert.equal(await ui.valor("Prazo"), dados.prazo);
      for (const rotulo of ["Projeto", "Status", "Prioridade"])
        assert.equal(
          await ui.valor(rotulo),
          dados[
            {
              Projeto: "projetoId",
              Status: "status",
              Prioridade: "prioridade",
            }[rotulo]
          ],
          rotulo,
        );
      gravacoes.length = 0;
      await salvar().click();
      await ate("retorno ao detalhe", async () => caminho() === "/tarefas/1");
      await page
        .getByRole("heading", { name: dados.titulo, exact: true })
        .waitFor();
      assert.deepEqual(gravacoes, [
        { metodo: "PATCH", caminho: "/tarefas/1", dados },
      ]);
      const db = await lerBanco();
      assert.equal(db.tarefas.length, seed.tarefas.length);
      assert.deepEqual(
        db.tarefas.find((t) => t.id === "1"),
        { id: "1", ...dados },
      );
      assert.deepEqual(
        db.tarefas.filter((t) => t.id !== "1"),
        seed.tarefas.filter((t) => t.id !== "1"),
      );
      await page.reload();
      await page
        .getByRole("heading", { name: dados.titulo, exact: true })
        .waitFor();
      await abrir();
      assert.equal(await ui.valor("Projeto"), "2");
      assert.equal(await ui.valor("Descrição"), dados.descricao);
    },
  );

  await conferir(
    "cancelar e fechar retornam ao detalhe sem gravar",
    async () => {
      const antes = await lerBanco();
      gravacoes.length = 0;
      for (const acao of ["Cancelar", "Fechar editar tarefa", "Escape"]) {
        await abrir();
        await campo("Título").fill("Alteração cancelada");
        if (acao === "Escape") await page.keyboard.press("Escape");
        else
          await page.getByRole("button", { name: acao, exact: true }).click();
        await ate(
          `detalhe após ${acao}`,
          async () => caminho() === "/tarefas/1",
        );
        await page
          .getByRole("dialog", { name: "Detalhes da tarefa", exact: true })
          .waitFor();
        assert.equal(await page.locator("form").count(), 0);
      }
      await page.keyboard.press("Escape");
      await ate("lista após segundo Escape", async () => caminho() === "/");
      assert.equal(gravacoes.length, 0);
      assert.deepEqual(await lerBanco(), antes);
    },
  );

  await conferir(
    "clique fora: sem alteração volta ao detalhe; com alteração fica na edição com os valores",
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
      await abrir();
      await fora();
      await ate(
        "detalhe após clique fora sem alteração",
        async () => caminho() === "/tarefas/1",
      );
      await page
        .getByRole("dialog", { name: "Detalhes da tarefa", exact: true })
        .waitFor();
      const dados = await abrir();
      const outroStatus =
        dados.status === "concluida" ? "A fazer" : "Concluída";
      await ui.escolher("Status", outroStatus);
      await fora();
      await assentar();
      assert.equal(
        await page.locator(".e-form-overlay[data-exiting]").count(),
        0,
      );
      assert.equal(caminho(), "/tarefas/1/editar");
      assert.equal(
        await page
          .getByRole("dialog", { name: "Editar tarefa", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await ui
          .seletor("Status")
          .innerText()
          .then((texto) => texto.includes(outroStatus)),
        true,
      );
      await campo("Título").fill("Rascunho mantido");
      await fora();
      await assentar();
      assert.equal(
        await page.locator(".e-form-overlay[data-exiting]").count(),
        0,
      );
      assert.equal(caminho(), "/tarefas/1/editar");
      assert.equal(await campo("Título").inputValue(), "Rascunho mantido");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await ate(
        "Cancelar segue voltando ao detalhe",
        async () => caminho() === "/tarefas/1",
      );
      assert.equal(gravacoes.length, 0);
    },
  );

  await conferir(
    "ID inexistente encerra carregamento e não abre formulário",
    async () => {
      await page.goto(`${origem}/tarefas/999/editar`);
      await page
        .getByRole("alert")
        .filter({ hasText: "Tarefa não encontrada." })
        .waitFor();
      assert.equal(await page.title(), "Tarefa não encontrada · Pixel");
      assert.equal(await page.locator("form").count(), 0);
      assert.equal(await page.getByRole("status").count(), 0);
    },
  );

  await conferir(
    "falha de leitura informa erro e encerra carregamento",
    async () => {
      await page.route(`${api}/tarefas/1`, (route) =>
        route.abort("connectionrefused"),
      );
      await page.goto(`${origem}/tarefas/1/editar`);
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível carregar a tarefa" })
        .waitFor();
      assert.equal(await page.title(), "Editar tarefa · Pixel");
      assert.equal(await page.locator("form").count(), 0);
      assert.equal(await page.getByRole("status").count(), 0);
      await page.unrouteAll();
    },
  );

  await conferir(
    "trocar ID reinicia campos e ignora leitura atrasada",
    async () => {
      await abrir("1");
      await campo("Título").fill("Rascunho da tarefa anterior");
      await trocarRota("/tarefas/2/editar");
      await esperarFormulario("2");
      assert.equal(await campo("Título").inputValue(), seed.tarefas[1].titulo);
      const leitura = await segurar(`${api}/tarefas/1`, {
        responder: (route) => route.fulfill({ json: seed.tarefas[0] }),
      });
      await trocarRota("/tarefas/1/editar");
      await ate(
        "leitura atrasada iniciada",
        async () => leitura.pedidos.length > 0,
      );
      assert.equal(await page.locator("form").count(), 0);
      await trocarRota("/tarefas/2/editar");
      await esperarFormulario("2");
      await leitura.liberar();
      assert.equal(await campo("Título").inputValue(), seed.tarefas[1].titulo);
      await page.unrouteAll();
    },
  );

  await conferir(
    "PATCH com erro preserva os dados e permite tentar novamente",
    async () => {
      await abrir("2");
      await campo("Título").fill("Título preservado após falha");
      await page.route(`${api}/tarefas/2`, (route) =>
        route.request().method() === "PATCH"
          ? route.fulfill({ status: 500, json: {} })
          : route.continue(),
      );
      await salvar().click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Não foi possível salvar. Tente novamente." })
        .waitFor();
      assert.equal(caminho(), "/tarefas/2/editar");
      assert.equal(
        await campo("Título").inputValue(),
        "Título preservado após falha",
      );
      await ate("envio liberado após erro", () => salvar().isEnabled());
      await page.unrouteAll();
      await salvar().click();
      await ate(
        "detalhe após nova tentativa",
        async () => caminho() === "/tarefas/2",
      );
      await page
        .getByRole("heading", {
          name: "Título preservado após falha",
          exact: true,
        })
        .waitFor();
    },
  );

  await conferir(
    "envio pendente bloqueia duplicação e só navega após a resposta",
    async () => {
      await abrir();
      const envio = await segurar(`${api}/tarefas/1`, { metodo: "PATCH" });
      gravacoes.length = 0;
      await salvar().click();
      await ate("botão bloqueado", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await page.evaluate(() => document.querySelector("form").requestSubmit());
      await assentar();
      assert.equal(caminho(), "/tarefas/1/editar");
      assert.equal(gravacoes.length, 1);
      await envio.liberar();
      await ate(
        "detalhe após gravação",
        async () => caminho() === "/tarefas/1",
      );
      assert.equal(gravacoes.length, 1);
      await page.unrouteAll();
    },
  );

  await conferir(
    "sair durante gravação não permite redirecionamento atrasado",
    async () => {
      await abrir();
      const tarefa = (await lerBanco()).tarefas.find((t) => t.id === "1");
      const envio = await segurar(`${api}/tarefas/1`, {
        metodo: "PATCH",
        responder: (route) => route.fulfill({ json: tarefa }),
      });
      await salvar().click();
      await ate("envio em curso", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await trocarRota("/projetos");
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
      assert.equal(caminho(), "/projetos");
      await page.unrouteAll();
    },
  );

  await conferir(
    "trocar tarefa durante gravação não altera o novo contexto",
    async () => {
      await abrir();
      const tarefa = (await lerBanco()).tarefas.find((t) => t.id === "1");
      const envio = await segurar(`${api}/tarefas/1`, {
        metodo: "PATCH",
        responder: (route) => route.fulfill({ json: tarefa }),
      });
      await salvar().click();
      await ate("envio em curso", () =>
        page.locator('form button[type="submit"]').isDisabled(),
      );
      await trocarRota("/tarefas/2/editar");
      const atual = await esperarFormulario("2");
      await envio.liberar();
      assert.equal(caminho(), "/tarefas/2/editar");
      assert.equal(await campo("Título").inputValue(), atual.titulo);
      assert.equal(await salvar().isEnabled(), true);
      await page.unrouteAll();
    },
  );

  await conferir(
    "edição em 320px, foco visível e envio por teclado",
    async () => {
      await page.setViewportSize({ width: 320, height: 800 });
      await abrir();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await campo("Título").focus();
      assert.equal(await focoVisivel(campo("Título")), true);
      await ui.abrirDescricao();
      await campo("Título").focus();
      for (const alvo of [
        campo("Responsável"),
        campo("Descrição"),
        ui.seletor("Projeto"),
        ui.atalhoPrazo(),
        ui.seletor("Status"),
        ui.seletor("Prioridade"),
        ui.alternarDescricao(),
      ]) {
        await page.keyboard.press("Tab");
        assert.equal(
          await alvo.evaluate((el) => el === document.activeElement),
          true,
          `ordem de tabulação: ${alvo}`,
        );
        assert.equal(await focoVisivel(alvo), true, `foco visível: ${alvo}`);
      }
      if (process.env.EDITAR_TAREFA_EVIDENCIAS) {
        await mkdir(process.env.EDITAR_TAREFA_EVIDENCIAS, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.EDITAR_TAREFA_EVIDENCIAS,
            "editar-tarefa-320.png",
          ),
          fullPage: true,
        });
      }
      await campo("Título").focus();
      await page.keyboard.press("Enter");
      await ate("envio pelo teclado", async () => caminho() === "/tarefas/1");
    },
  );

  await conferir(
    "salvar a partir da lista rolada mantém a rolagem e devolve o foco ao título do cartão",
    async () => {
      await page.setViewportSize({ width: 1280, height: 360 });
      await page.goto(`${origem}/`);
      await page.locator("[data-task-id]").first().waitFor();
      const id = await page
        .locator(".e-list > [data-task-id]")
        .last()
        .getAttribute("data-task-id");
      const cartao = page.locator(`[data-task-id="${id}"]`);
      await page.evaluate(() =>
        scrollTo(0, document.documentElement.scrollHeight),
      );
      const rolagem = await page.evaluate(() => scrollY);
      assert.ok(rolagem > 0, "a lista precisa estar rolada");
      await cartao.locator(".e-task-menu").click();
      await page.getByRole("menuitem", { name: "Editar tarefa" }).click();
      const dados = await esperarFormulario(id);
      await campo("Responsável").fill(`${dados.responsavel} editado`);
      await salvar().click();
      await page
        .getByRole("button", { name: "Editar tarefa", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      await ate("foco no título do cartão editado", () =>
        page.evaluate(
          (alvo) =>
            document.activeElement?.matches(
              `[data-task-id="${alvo}"] .e-task-title`,
            ) ?? false,
          id,
        ),
      );
      const estado = await page.evaluate(() => {
        const caixa = document.activeElement.getBoundingClientRect();
        return {
          rolagem: scrollY,
          visivel:
            caixa.width > 1 &&
            caixa.height > 1 &&
            caixa.top >= 0 &&
            caixa.bottom <= innerHeight,
        };
      });
      assert.deepEqual(estado, { rolagem, visivel: true });
      await page.setViewportSize({ width: 1280, height: 900 });
    },
  );

  await conferir(
    "fechar o detalhe depois de salvar não busca de novo a página de fundo",
    async () => {
      const leituras = [];
      const ouvir = (req) => {
        if (req.url().startsWith(api) && req.method() === "GET")
          leituras.push(new URL(req.url()).pathname);
      };
      await page.goto(`${origem}/`);
      const cartao = page.locator('[data-task-id="5"]');
      await cartao.locator(".e-task-title").click();
      await page
        .getByRole("button", { name: "Editar tarefa", exact: true })
        .click();
      await esperarFormulario("5");
      const titulo = "Título salvo antes de fechar";
      await campo("Título").fill(titulo);
      await salvar().click();
      await page.getByRole("heading", { name: titulo, exact: true }).waitFor();
      await cartao.getByText(titulo, { exact: true }).waitFor();
      await assentar();
      page.on("request", ouvir);
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(caminho(), "/");
      await assentar();
      page.off("request", ouvir);
      assert.deepEqual(leituras, []);
      await cartao.getByText(titulo, { exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector('[data-task-id="5"] .e-task-title'),
      );
      await page.goForward();
      await page.getByRole("heading", { name: titulo, exact: true }).waitFor();
      assert.equal(caminho(), "/tarefas/5");
      await page.goBack();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      assert.equal(caminho(), "/");
      await cartao.locator(".e-task-title").click();
      await page
        .getByRole("button", { name: "Editar tarefa", exact: true })
        .click();
      await esperarFormulario("5");
      const segundo = "Título salvo pela segunda vez";
      await campo("Título").fill(segundo);
      await salvar().click();
      await page.getByRole("heading", { name: segundo, exact: true }).waitFor();
      await cartao.getByText(segundo, { exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
    },
  );

  await conferir(
    "sem erros JavaScript e bancos do repositório preservados",
    async () => {
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
  console.log(`${total} cenários aprovados; bancos originais preservados.`);
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
