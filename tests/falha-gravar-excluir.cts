const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { criarUi, comTextos } = require("./ui.cts");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();
const { portaLivre, esperar, iniciar } = apoio;

const raiz = join(__dirname, "..");
let browser;

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-falha-gravar-" });
  const seed = JSON.parse(seedOriginal);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;

  let servidorApi;
  const ligarApi = async () => {
    servidorApi = iniciar("node_modules/json-server/lib/bin.js", [
      banco,
      "--host",
      "127.0.0.1",
      "--port",
      String(portaApi),
    ]);
    await esperar(`${api}/tarefas`);
  };
  const desligarApi = async () => {
    servidorApi.parado = true;
    const encerrado = new Promise((resolve) =>
      servidorApi.once("exit", resolve),
    );
    servidorApi.kill();
    await encerrado;
    await assert.rejects(fetch(`${api}/tarefas`));
  };
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));

  iniciar(
    "node_modules/vite/bin/vite.js",
    [
      "--host",
      "127.0.0.1",
      "--port",
      String(portaWeb),
      "--strictPort",
      "--mode",
      "test",
    ],
    { ...process.env, VITE_API_URL: api, VITE_API_TEMPO_LIMITE_MS: "1000" },
  );
  await Promise.all([ligarApi(), esperar(web)]);

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const ficha = () => page.locator(".e-form-overlay").getByRole("dialog");
  const ui = criarUi(page, () => ficha().locator("form"));
  const focoDentro = (locator) =>
    locator.evaluate(
      (el) =>
        el.contains(document.activeElement) && document.activeElement !== el,
    );

  async function conferirLimite(caminho, metodo, botao, aviso) {
    const semResposta = (rota) =>
      rota.request().method() === metodo ? undefined : rota.continue();
    await page.route(`${api}${caminho}`, semResposta);
    try {
      await botao.click();
      await aviso.waitFor();
      assert.equal(await botao.isEnabled(), true);
      assert.equal(await botao.getAttribute("data-pending"), null);
      console.log(
        `OK: ${metodo} ${caminho} sem resposta avisa e libera nova tentativa`,
      );
    } finally {
      await page.unroute(`${api}${caminho}`, semResposta);
    }
  }

  const novaTarefa = comTextos(
    {
      projetoId: "2",
      titulo: "Entregar o protótipo",
      descricao: "Com as telas de cadastro",
      status: "em-revisao",
      prioridade: "alta",
      responsavel: "Carla",
      prazo: "2026-12-10",
    },
    seed.projetos,
  );
  await page.goto(`${web}/tarefas/nova`);
  await ui.campo("Título").waitFor();
  while (!(await ui.projetosCarregados(2))) await page.waitForTimeout(50);
  await ui.preencherTarefa(novaTarefa);
  await conferirLimite(
    "/tarefas",
    "POST",
    ficha().getByRole("button", { name: "Salvar", exact: true }),
    ficha().getByRole("alert").filter({
      hasText: "Não foi possível salvar. Tente novamente.",
    }),
  );
  assert.equal(
    (await lerBanco()).tarefas.some(
      (tarefa) => tarefa.titulo === novaTarefa.titulo,
    ),
    false,
  );
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar", exact: true }).click();
  await ficha()
    .getByRole("alert")
    .filter({
      hasText: "Não foi possível salvar. Tente novamente.",
    })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/tarefas/nova");
  for (const [rotulo, chave] of [
    ["Título", "titulo"],
    ["Descrição", "descricao"],
    ["Responsável", "responsavel"],
    ["Prazo", "prazo"],
    ["Projeto", "projetoId"],
    ["Status", "status"],
    ["Prioridade", "prioridade"],
  ]) {
    assert.equal(await ui.valor(rotulo), novaTarefa[chave], rotulo);
  }
  assert.equal(
    await focoDentro(ficha()),
    true,
    "foco saiu da ficha após a falha",
  );
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForURL(`${web}/`);
  await page
    .getByRole("link", { name: novaTarefa.titulo, exact: true })
    .waitFor();
  assert.equal(
    (await lerBanco()).tarefas.filter(
      (tarefa) => tarefa.titulo === novaTarefa.titulo,
    ).length,
    1,
  );
  console.log(
    "OK: cadastrar tarefa com a API parada avisa, mantém os sete campos e grava ao tentar de novo",
  );

  await page.goto(`${web}/tarefas/1/editar`);
  await ui.campo("Título").waitFor();
  await ui.campo("Título").fill("Criar o repositório no GitHub");
  await ui.campo("Responsável").fill("Davi");
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await ficha()
    .getByRole("alert")
    .filter({
      hasText:
        "Não foi possível salvar a tarefa. Seus dados foram mantidos; tente de novo.",
    })
    .waitFor();
  assert.equal(await ui.valor("Título"), "Criar o repositório no GitHub");
  assert.equal(await ui.valor("Responsável"), "Davi");
  assert.equal(
    await focoDentro(ficha()),
    true,
    "foco saiu da ficha após a falha",
  );
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(`${web}/tarefas/1`);
  await ficha()
    .getByRole("heading", { name: "Criar o repositório no GitHub" })
    .waitFor();
  console.log(
    "OK: editar tarefa com a API parada avisa, mantém o texto e grava ao tentar de novo",
  );

  const ficharProjeto = criarUi(page, () => ficha().locator("form"));
  await page.goto(`${web}/projetos/novo`);
  await ficharProjeto.campo("Nome").waitFor();
  await ficharProjeto.campo("Nome").fill("Portfólio da turma");
  await ficharProjeto.campo("Descrição").fill("Página com os trabalhos");
  await ficharProjeto.campo("Disciplina").fill("DFE");
  await ficharProjeto.campo("Criado em").fill("2026-10-20");
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar projeto" }).click();
  await ficha()
    .getByRole("alert")
    .filter({
      hasText:
        "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo.",
    })
    .waitFor();
  for (const [rotulo, esperado] of [
    ["Nome", "Portfólio da turma"],
    ["Descrição", "Página com os trabalhos"],
    ["Disciplina", "DFE"],
    ["Criado em", "2026-10-20"],
  ]) {
    assert.equal(
      await ficharProjeto.campo(rotulo).inputValue(),
      esperado,
      rotulo,
    );
  }
  assert.equal(
    await focoDentro(ficha()),
    true,
    "foco saiu da ficha após a falha",
  );
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar projeto" }).click();
  await page.waitForURL(`${web}/projetos`);
  assert.equal(
    (await lerBanco()).projetos.filter(
      (projeto) => projeto.nome === "Portfólio da turma",
    ).length,
    1,
  );
  console.log(
    "OK: cadastrar projeto com a API parada avisa, mantém os campos e grava ao tentar de novo",
  );

  await page.goto(`${web}/projetos/2/editar`);
  await ficharProjeto.campo("Nome").waitFor();
  await ficharProjeto.campo("Nome").fill("Modelagem da Biblioteca Central");
  await conferirLimite(
    "/projetos/2",
    "PATCH",
    ficha().getByRole("button", { name: "Salvar alterações" }),
    ficha().getByRole("alert").filter({
      hasText:
        "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo.",
    }),
  );
  assert.equal(
    (await lerBanco()).projetos.find((projeto) => projeto.id === "2").nome,
    seed.projetos.find((projeto) => projeto.id === "2").nome,
  );
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await ficha()
    .getByRole("alert")
    .filter({
      hasText:
        "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo.",
    })
    .waitFor();
  assert.equal(
    await ficharProjeto.campo("Nome").inputValue(),
    "Modelagem da Biblioteca Central",
  );
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(`${web}/projetos/2`);
  await page
    .getByRole("heading", { level: 1, name: "Modelagem da Biblioteca Central" })
    .waitFor();
  console.log(
    "OK: editar projeto com a API parada avisa, mantém o texto e grava ao tentar de novo",
  );

  for (const [caminho, id, titulo] of [
    ["/", "2", "Subir o json-server"],
    ["/quadro", "3", "Montar o quadro no GitHub Projects"],
    ["/projetos/1", "4", "Listar as tarefas na tela"],
  ]) {
    await page.goto(`${web}${caminho}`);
    await page.locator(`[data-task-id="${id}"]`).waitFor();
    await page.getByRole("button", { name: `Ações de ${titulo}` }).click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    const dialogo = page.getByRole("dialog", { name: `Excluir ${titulo}` });
    await conferirLimite(
      `/tarefas/${id}`,
      "DELETE",
      dialogo.getByRole("button", { name: "Excluir tarefa", exact: true }),
      dialogo.getByRole("alert").filter({
        hasText: "Não foi possível excluir a tarefa. Tente de novo.",
      }),
    );
    assert.equal(
      (await lerBanco()).tarefas.some((tarefa) => tarefa.id === id),
      true,
    );
    await desligarApi();
    await dialogo
      .getByRole("button", { name: "Excluir tarefa", exact: true })
      .click();
    await dialogo
      .getByRole("alert")
      .filter({ hasText: "Não foi possível excluir a tarefa. Tente de novo." })
      .waitFor();
    assert.equal(
      await page.locator(`[data-task-id="${id}"]`).count(),
      1,
      `${caminho}: cartão sumiu sem excluir`,
    );
    assert.equal(
      await dialogo
        .getByRole("button", { name: "Excluir tarefa", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
      `${caminho}: foco saiu do botão de confirmar`,
    );
    await ligarApi();
    await page.keyboard.press("Enter");
    await dialogo.waitFor({ state: "detached" });
    await page.locator(`[data-task-id="${id}"]`).waitFor({ state: "detached" });
    assert.equal(
      (await lerBanco()).tarefas.some((tarefa) => tarefa.id === id),
      false,
    );
    console.log(
      `OK: ${caminho} excluir com a API parada avisa, mantém o foco e exclui ao tentar de novo`,
    );
  }

  await page.goto(`${web}/`);
  const seletor = page.getByRole("button", {
    name: /^Mudar status de Desenhar o diagrama ER/,
  });
  await seletor.waitFor();
  await desligarApi();
  await seletor.click();
  await page.getByRole("menuitemradio", { name: "Concluída" }).click();
  await page
    .locator('[data-task-id="5"]')
    .getByRole("alert")
    .filter({ hasText: "Não foi possível mudar o status. Tente de novo." })
    .waitFor();
  await page.waitForFunction(() =>
    document.activeElement?.matches('[data-task-id="5"] [data-status-trigger]'),
  );
  await ligarApi();
  console.log(
    "OK: mudar status com a API parada avisa e devolve o foco ao seletor",
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
