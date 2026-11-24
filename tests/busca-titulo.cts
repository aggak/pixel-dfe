const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

async function executar() {
  let browser;
  try {
    const dados = JSON.parse(await readFile("db.seed.json", "utf8"));
    const { banco } = await apoio.criarBanco({ prefixo: "pixel-busca-" });
    const { web } = await apoio.subirAmbiente({ banco });

    browser = await apoio.abrirNavegador();
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(web);
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    await lista.getByRole("article").first().waitFor();
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );
    assert.equal(
      await page.locator("main p.sr-only[aria-live=polite]").innerText(),
      "",
    );

    const painel = await page.locator(".e-sheet").boundingBox();
    const campoDesktop = await busca.boundingBox();
    const acao = page
      .locator(".e-top")
      .getByRole("button", { name: "Nova tarefa", exact: true });
    const acaoDesktop = await acao.boundingBox();
    assert.ok(
      campoDesktop.x >= painel.x &&
        campoDesktop.x + campoDesktop.width <= painel.x + painel.width,
    );
    assert.ok(acaoDesktop.y + acaoDesktop.height < campoDesktop.y);
    await page.setViewportSize({ width: 375, height: 800 });
    const campoCelular = await busca.boundingBox();
    const filtroCelular = await page
      .getByRole("button", { name: /Status/ })
      .boundingBox();
    const acaoCelular = await acao.boundingBox();
    assert.ok(
      acaoCelular.y + acaoCelular.height < campoCelular.y &&
        campoCelular.y < filtroCelular.y,
    );
    assert.ok(campoCelular.width > 300);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.setViewportSize({ width: 1280, height: 800 });

    await busca.focus();
    await page.keyboard.type("JSON");
    assert.equal(await lista.getByRole("article").count(), 1);
    await lista.getByRole("link", { name: "Subir o json-server" }).waitFor();
    assert.match(
      await page.locator(".e-sheet-footer").innerText(),
      new RegExp(`^1 de ${dados.tarefas.length} tarefas$`),
    );

    const anuncio = page.locator("main p.sr-only[aria-live=polite]");
    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "0 tarefas encontradas.",
    );
    assert.equal(await page.getByRole("article").count(), 0);
    assert.match(
      await page.locator(".e-sheet-footer").innerText(),
      new RegExp(`^0 de ${dados.tarefas.length} tarefas$`),
    );

    await busca.press("ControlOrMeta+A");
    await busca.press("Backspace");
    await lista.getByRole("article").first().waitFor();
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );
    assert.equal(await busca.inputValue(), "");

    for (const [termo, titulo] of [
      ["repositorio", "Criar o repositório"],
      ["REPOSITÓRIO", "Criar o repositório"],
      ["tárefas", "Listar as tarefas na tela"],
      ["tarefas  na   tela", "Listar as tarefas na tela"],
    ]) {
      await busca.fill(termo);
      await lista.getByRole("link", { name: titulo, exact: true }).waitFor();
      assert.equal(await lista.getByRole("article").count(), 1, termo);
      assert.equal(await busca.inputValue(), termo);
      await page.waitForFunction(
        () =>
          document.querySelector("main p.sr-only[aria-live=polite]")
            ?.textContent === "1 tarefa encontrada.",
      );
    }
    await busca.fill("repositorioo");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await busca.fill("");
    await lista.getByRole("article").first().waitFor();
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );

    const selecionar = async (nome, opcao) => {
      await page.getByRole("button", { name: new RegExp(nome) }).click();
      await page.getByRole("option", { name: opcao, exact: true }).click();
    };
    await selecionar("Status", "A fazer");
    assert.equal(await lista.getByRole("article").count(), 2);
    await selecionar("Prioridade", "Média");
    assert.equal(await lista.getByRole("article").count(), 1);
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "1 tarefa encontrada.",
    );
    assert.equal(await anuncio.getAttribute("aria-atomic"), "true");
    await lista
      .getByRole("link", { name: "Listar as tarefas na tela" })
      .waitFor();

    await busca.fill("LISTAR");
    assert.equal(await lista.getByRole("article").count(), 1);
    await busca.fill("json");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await busca.fill("");
    await lista
      .getByRole("link", { name: "Listar as tarefas na tela" })
      .waitFor();
    assert.equal(await lista.getByRole("article").count(), 1);

    await selecionar("Status", "Todos");
    assert.equal(await lista.getByRole("article").count(), 2);
    await selecionar("Prioridade", "Todas");
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );

    await page
      .getByRole("navigation", { name: "Projetos" })
      .getByRole("link", { name: "Gerenciador de Tarefas" })
      .click();
    const projeto = page.getByRole("region", { name: "Tarefas do projeto" });
    await projeto.getByRole("article").first().waitFor();
    assert.equal(
      await projeto.getByRole("article").count(),
      dados.tarefas.filter((tarefa) => tarefa.projetoId === "1").length,
    );
    await page
      .getByRole("navigation", { name: "Projetos" })
      .getByRole("link", { name: "Todas" })
      .click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(
      await lista.getByRole("article").count(),
      dados.tarefas.length,
    );
    console.log(
      "OK: busca sem acentos e com espaços repetidos, filtros combinados, limpeza e abas de projeto",
    );

    const excluirPeloMenu = async (titulo) => {
      await lista.getByRole("button", { name: `Ações de ${titulo}` }).click();
      await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
      await page.locator('[role="menuitem"][data-pronto]').click();
    };
    await busca.fill("json-server");
    await lista.getByRole("link", { name: "Subir o json-server" }).waitFor();
    assert.equal(await lista.getByRole("article").count(), 1);
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "1 tarefa encontrada.",
    );
    await excluirPeloMenu("Subir o json-server");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-task-id]").length === 0,
    );
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "0 tarefas encontradas.",
    );
    assert.equal(await page.locator("main p[role=status]").count(), 0);
    console.log(
      "OK: excluir o único resultado da busca atualiza a contagem anunciada, sem anúncio de exclusão",
    );

    await busca.fill("repositório");
    await lista
      .getByRole("link", { name: "Criar o repositório", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "1 tarefa encontrada.",
    );
    await lista
      .getByRole("link", { name: "Criar o repositório", exact: true })
      .click();
    const ficha = page.getByRole("dialog", { name: "Detalhes da tarefa" });
    await ficha.getByRole("button", { name: "Excluir tarefa" }).click();
    await ficha.locator(".e-read-delete[data-pronto]").click();
    await ficha.waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        document.querySelector("main p.sr-only[aria-live=polite]")
          ?.textContent === "0 tarefas encontradas." &&
        [...document.querySelectorAll("main p[role=status]")]
          .map((p) => p.textContent)
          .join("\n") === "Tarefa Criar o repositório excluída.",
    );
    assert.equal(await page.locator("main p[role=status]").count(), 1);
    console.log(
      "OK: excluir pela ficha mantém um único anúncio de exclusão e atualiza a contagem",
    );
  } finally {
    await apoio.encerrar();
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
