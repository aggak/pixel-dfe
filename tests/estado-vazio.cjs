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
  const seed = JSON.parse(seedOriginal);
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-vazio-" });
  const { api, web } = await apoio.subirAmbiente({ banco });

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const vazio = (titulo) =>
    page
      .getByRole("main")
      .locator(".e-empty")
      .filter({ has: page.getByRole("heading", { name: titulo }) });
  const busca = () => page.getByPlaceholder("Buscar tarefas");

  await page.route(`${api}/tarefas`, (rota) => rota.fulfill({ json: [] }));
  for (const caminho of ["/", "/quadro"]) {
    await page.goto(`${web}${caminho}`);
    await vazio("Nenhuma tarefa por aqui").waitFor();
    assert.equal(
      await vazio("Nenhuma tarefa por aqui")
        .locator(".e-gato-dormindo")
        .count(),
      1,
    );
    assert.equal(await page.locator("[data-task-id]").count(), 0);
    assert.equal(await page.locator(".e-column").count(), 0);
    await vazio("Nenhuma tarefa por aqui")
      .getByRole("button", { name: "Criar tarefa" })
      .click();
    await page.getByRole("dialog").locator("form").waitFor();
  }
  await page.unrouteAll();
  console.log("OK: lista e quadro sem tarefas avisam e oferecem criar tarefa");

  await page.route(`${api}/projetos/2?_embed=tarefas`, (rota) =>
    rota.fulfill({ json: { ...seed.projetos[1], tarefas: [] } }),
  );
  await page.goto(`${web}/projetos/2`);
  await vazio("Este projeto ainda não tem tarefas").waitFor();
  assert.equal(
    await vazio("Este projeto ainda não tem tarefas")
      .locator(".e-gato-dormindo")
      .count(),
    1,
  );
  assert.match(
    await page.locator(".e-sheet-footer").innerText(),
    /^0 tarefas$/,
  );
  await vazio("Este projeto ainda não tem tarefas")
    .getByRole("button", { name: "Criar tarefa" })
    .click();
  await page
    .getByRole("dialog")
    .locator('select[name="projetoId"]')
    .waitFor({ state: "attached" });
  assert.equal(
    await page
      .getByRole("dialog")
      .locator('select[name="projetoId"]')
      .inputValue(),
    "2",
  );
  await page.unrouteAll();
  console.log("OK: projeto sem tarefas avisa e cria tarefa já no projeto");

  for (const caminho of ["/", "/quadro"]) {
    await page.goto(`${web}${caminho}`);
    await page.locator("[data-task-id]").first().waitFor();
    await busca().fill("sem correspondência");
    await vazio("Nenhuma tarefa encontrada").waitFor();
    assert.equal(
      await vazio("Nenhuma tarefa encontrada")
        .locator(".e-gato-olhando")
        .count(),
      1,
    );
    assert.equal(await page.locator("[data-task-id]").count(), 0);
    assert.equal(await page.locator(".e-column").count(), 0);
    assert.equal(await vazio("Nenhuma tarefa por aqui").count(), 0);
    await vazio("Nenhuma tarefa encontrada")
      .getByRole("button", { name: "Limpar busca e filtros" })
      .click();
    await page.locator("[data-task-id]").first().waitFor();
    assert.equal(
      await page.locator("[data-task-id]").count(),
      seed.tarefas.length,
    );
    assert.equal(await busca().inputValue(), "");
  }
  console.log(
    "OK: busca sem resultado avisa na lista e no quadro, e a limpeza restaura as tarefas",
  );

  const projetoUnico = seed.projetos.find(
    (projeto) =>
      seed.tarefas.filter((tarefa) => tarefa.projetoId === projeto.id)
        .length === 1,
  );
  const tarefaUnica = seed.tarefas.find(
    (tarefa) => tarefa.projetoId === projetoUnico.id,
  );
  await page.goto(`${web}/projetos/${projetoUnico.id}`);
  await page
    .getByRole("button", { name: `Ações de ${tarefaUnica.titulo}` })
    .click();
  await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir tarefa" })
    .click();
  await vazio("Este projeto ainda não tem tarefas").waitFor();
  assert.equal(
    await vazio("Este projeto ainda não tem tarefas")
      .locator(".e-gato-dormindo")
      .count(),
    1,
  );
  assert.match(
    await page.locator(".e-sheet-footer").innerText(),
    /^0 tarefas$/,
  );
  console.log("OK: excluir a última tarefa do projeto mostra o estado vazio");

  const semCombinacao = seed.tarefas.find(
    (tarefa) =>
      !seed.tarefas.some(
        (outra) =>
          outra.status === "concluida" && outra.titulo === tarefa.titulo,
      ),
  );
  await page.goto(`${web}/`);
  await page.locator("[data-task-id]").first().waitFor();
  await busca().fill(semCombinacao.titulo);
  await page.getByRole("button", { name: /Status/ }).click();
  await page.getByRole("option", { name: "Concluída" }).click();
  await vazio("Nenhuma tarefa encontrada").waitFor();
  assert.equal(
    await page.locator(".e-sheet-footer").innerText(),
    `0 de ${seed.tarefas.length - 1} tarefas`,
  );
  await vazio("Nenhuma tarefa encontrada")
    .getByRole("button", { name: "Limpar busca e filtros" })
    .click();
  await page.locator("[data-task-id]").first().waitFor();
  assert.match(
    await page.getByRole("button", { name: /Status/ }).innerText(),
    /Todos/,
  );
  console.log(
    "OK: busca e filtro combinados sem resultado avisam e são limpos juntos",
  );

  await page.route(`${api}/projetos`, (rota) => rota.fulfill({ json: [] }));
  await page.goto(`${web}/projetos`);
  await vazio("Nenhum projeto por aqui").waitFor();
  assert.equal(
    await vazio("Nenhum projeto por aqui").locator(".e-gato-dormindo").count(),
    1,
  );
  await vazio("Nenhum projeto por aqui")
    .getByRole("button", { name: "Criar projeto" })
    .click();
  await page.getByRole("dialog").getByLabel(/^Nome/).waitFor();
  await page.unrouteAll();
  console.log("OK: lista de projetos vazia avisa e oferece criar projeto");

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
