const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { comTextos, criarUi, TEXTO_STATUS } = require("./ui.cts");

const ORDEM = ["a-fazer", "em-andamento", "em-revisao", "concluida"];

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

async function executar() {
  const originais = await Promise.all(
    ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
      readFile(arquivo, "utf8"),
    ),
  );
  const evidencias = process.env.QUADRO_EVIDENCIAS;
  let browser;
  try {
    const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
    const { banco } = await apoio.criarBanco({ prefixo: "pixel-quadro-" });
    const { api, web } = await apoio.subirAmbiente({ banco, tentativas: 300 });

    browser = await apoio.abrirNavegador();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const errosJs = [];
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    const ui = criarUi(page);
    const quadro = page.getByRole("region", {
      name: "Quadro de tarefas por status",
    });
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const coluna = (status) => page.locator(`[data-status-column="${status}"]`);
    const idsDaColuna = (status) =>
      coluna(status)
        .locator("[data-task-id]")
        .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const seletor = (nome) =>
      page.getByRole("button", { name: new RegExp(nome) });
    const selecionar = async (nome, opcao) => {
      await seletor(nome).click();
      const item = page.getByRole("option", { name: opcao, exact: true });
      await item.click();
      await item.waitFor({ state: "detached" });
    };
    const irPara = (caminho) =>
      page
        .getByRole("navigation", { name: "Visualização das tarefas" })
        .getByRole("link", {
          name: caminho === "/quadro" ? "Quadro" : "Lista",
          exact: true,
        })
        .click();
    const lerBanco = async () => (await fetch(`${api}/tarefas`)).json();

    await page.goto(`${web}/quadro`);
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.deepEqual(
      await page.locator(".e-column-name").allInnerTexts(),
      ORDEM.map((status) => TEXTO_STATUS[status]),
    );
    console.log("OK: /quadro abre com as quatro colunas na ordem do contrato");

    for (const status of ORDEM) {
      const esperadas = seed.tarefas.filter((t) => t.status === status);
      assert.deepEqual(
        await idsDaColuna(status),
        esperadas.map((t) => t.id),
      );
      assert.equal(
        await coluna(status).locator("h2 > span:last-child").innerText(),
        String(esperadas.length),
      );
      for (const tarefa of esperadas)
        assert.equal(
          await coluna(status)
            .getByRole("link", { name: tarefa.titulo, exact: true })
            .count(),
          1,
        );
    }
    assert.match(
      await page.locator(".e-sheet-footer").innerText(),
      new RegExp(`^${seed.tarefas.length} tarefas$`),
    );
    if (evidencias)
      await page.screenshot({
        path: join(evidencias, "quadro-1280.png"),
        fullPage: true,
      });
    console.log(
      "OK: cada tarefa aparece uma vez na coluna do seu status, com contador",
    );

    await selecionar("Status", "A fazer");
    for (const status of ORDEM.slice(1))
      assert.equal(
        await coluna(status)
          .getByText("Nenhuma tarefa encontrada", { exact: true })
          .count(),
        1,
      );
    assert.equal(await page.locator(".e-column").count(), 4);
    assert.deepEqual(
      await idsDaColuna("a-fazer"),
      seed.tarefas.filter((t) => t.status === "a-fazer").map((t) => t.id),
    );
    console.log("OK: colunas filtradas continuam visíveis com texto de busca");

    await selecionar("Status", "Todos");
    const tarefaBuscada = seed.tarefas.find((t) => t.status === "a-fazer");
    await busca.fill(tarefaBuscada.titulo);
    for (const status of ORDEM.slice(1))
      assert.equal(
        await coluna(status)
          .getByText("Nenhuma tarefa encontrada", { exact: true })
          .count(),
        1,
      );
    await busca.fill("");
    await page.route(`${api}/tarefas`, (route) =>
      route.fulfill({
        json: seed.tarefas.filter((t) => t.status !== "concluida"),
      }),
    );
    await page.reload();
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.equal(
      await coluna("concluida")
        .getByText("Nenhuma tarefa", { exact: true })
        .count(),
      1,
    );
    await selecionar("Status", "A fazer");
    assert.equal(
      await coluna("concluida")
        .getByText("Nenhuma tarefa", { exact: true })
        .count(),
      1,
    );
    assert.equal(
      await coluna("em-revisao")
        .getByText("Nenhuma tarefa encontrada", { exact: true })
        .count(),
      1,
    );
    await page.unroute(`${api}/tarefas`);
    await page.reload();
    await quadro.locator("[data-task-id]").first().waitFor();
    console.log(
      "OK: busca e filtro distinguem tarefas escondidas de coluna realmente vazia",
    );

    await selecionar("Status", "A fazer");

    await busca.fill("diagrama");
    const doQuadro = await quadro
      .locator("[data-task-id]")
      .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    await irPara("/");
    await lista.getByRole("article").first().waitFor();
    assert.equal(await quadro.count(), 0);
    assert.equal(await busca.inputValue(), "diagrama");
    assert.match(await seletor("Status").innerText(), /A fazer/);
    assert.deepEqual(
      await lista
        .locator("[data-task-id]")
        .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId)),
      doQuadro,
    );
    await busca.fill("");
    await selecionar("Status", "Todos");
    await selecionar("Prioridade", "Alta");
    const daLista = await lista
      .locator("[data-task-id]")
      .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId));
    await irPara("/quadro");
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.match(await seletor("Prioridade").innerText(), /Alta/);
    assert.deepEqual(
      (
        await quadro
          .locator("[data-task-id]")
          .evaluateAll((cartoes) => cartoes.map((c) => c.dataset.taskId))
      ).sort(),
      [...daLista].sort(),
    );
    assert.deepEqual(
      daLista.sort(),
      seed.tarefas
        .filter((t) => t.prioridade === "alta")
        .map((t) => t.id)
        .sort(),
    );
    console.log(
      "OK: lista e quadro leem o mesmo estado e mostram o mesmo conjunto",
    );

    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    assert.equal(await page.locator(".e-column").count(), 0);
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await coluna("a-fazer").locator("[data-task-id]").first().waitFor();
    assert.equal(
      await quadro.locator("[data-task-id]").count(),
      seed.tarefas.length,
    );
    console.log(
      "OK: busca sem resultado esconde as colunas e a limpeza restaura o quadro",
    );

    const alvo = seed.tarefas.find((t) => t.status === "a-fazer");
    await coluna("a-fazer").getByRole("link", { name: alvo.titulo }).click();
    const detalhe = page.getByRole("dialog", {
      name: "Detalhes da tarefa",
      exact: true,
    });
    await detalhe.waitFor();
    assert.equal(await quadro.count(), 1);
    await detalhe.getByRole("button", { name: /^Fechar/ }).click();
    await detalhe.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    await coluna("a-fazer")
      .getByRole("button", { name: `Ações de ${alvo.titulo}` })
      .click();
    await page.getByRole("menuitem", { name: "Editar tarefa" }).click();
    const edicao = page.getByRole("dialog", {
      name: "Editar tarefa",
      exact: true,
    });
    await edicao.waitFor();
    await ui.escolher("Status", "Em revisão");
    await edicao
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await detalhe.waitFor();
    await coluna("em-revisao").locator(`[data-task-id="${alvo.id}"]`).waitFor();
    assert.equal(
      await coluna("a-fazer").locator(`[data-task-id="${alvo.id}"]`).count(),
      0,
    );
    assert.equal(
      (await lerBanco()).find((t) => t.id === alvo.id).status,
      "em-revisao",
    );
    await detalhe.getByRole("button", { name: /^Fechar/ }).click();
    await detalhe.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    console.log(
      "OK: editar o status na ficha muda o cartão de coluna e mantém /quadro",
    );

    await page.locator('[data-action="new-task"]').click();
    const nova = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
    await nova.waitFor();
    await nova.getByRole("button", { name: /^Fechar/ }).click();
    await nova.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    await page.locator('[data-action="new-task"]').click();
    await nova.waitFor();
    await ui.preencherTarefa(
      comTextos(
        {
          projetoId: "2",
          titulo: "Revisar o quadro por status",
          descricao: "Conferir colunas e cartões.",
          status: "concluida",
          prioridade: "baixa",
          responsavel: "Euclides",
          prazo: "2026-10-27",
        },
        seed.projetos,
      ),
    );
    await nova
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await nova.waitFor({ state: "detached" });
    await page.waitForURL((url) => url.pathname === "/quadro");
    await coluna("concluida")
      .getByRole("link", { name: "Revisar o quadro por status" })
      .waitFor();
    assert.equal((await lerBanco()).length, seed.tarefas.length + 1);
    console.log(
      "OK: nova tarefa criada no quadro volta para ele, na coluna do status",
    );

    await page.reload();
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.equal(
      await quadro.locator("[data-task-id]").count(),
      seed.tarefas.length + 1,
    );
    for (const [largura, colunas] of [
      [1280, 4],
      [800, 2],
      [320, 1],
    ]) {
      await page.setViewportSize({ width: largura, height: 900 });
      const trilhas = await quadro.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      );
      assert.equal(trilhas, colunas, `${largura} px`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${largura} px`,
      );
    }
    if (evidencias)
      await page.screenshot({
        path: join(evidencias, "quadro-320.png"),
        fullPage: true,
      });
    console.log(
      "OK: acesso direto e recarga; 4, 2 e 1 colunas sem rolagem horizontal",
    );

    await page.setViewportSize({ width: 320, height: 300 });
    const distancia = await page.evaluate(() => {
      const coluna = [
        ...document.querySelectorAll<HTMLElement>(".e-column"),
      ].sort((a, b) => b.offsetHeight - a.offsetHeight)[0];
      [...coluna.querySelectorAll("[data-task-id]")]
        .at(-1)
        .scrollIntoView({ block: "end" });
      const titulo = coluna.querySelector("h2").getBoundingClientRect();
      const cabecalho = document
        .querySelector(".e-top")
        .getBoundingClientRect();
      return { topo: titulo.top - cabecalho.bottom, rolagem: scrollY };
    });
    assert.ok(distancia.rolagem > 0);
    assert.ok(Math.abs(distancia.topo) < 1, JSON.stringify(distancia));
    console.log(
      "OK: ao rolar, o título da coluna fica preso logo abaixo do cabeçalho",
    );

    assert.deepEqual(errosJs, []);
    const atuais = await Promise.all(
      ["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) =>
        readFile(arquivo, "utf8"),
      ),
    );
    assert.deepEqual(atuais, originais);
    console.log(
      "10 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.",
    );
  } finally {
    await apoio.encerrar();
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
