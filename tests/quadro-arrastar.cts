const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

async function executar() {
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-arrastar-" });
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  const { api, web } = await apoio.subirAmbiente({ banco, tentativas: 300 });
  const browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);
  const patches = [];
  page.on("request", (requisicao) => {
    if (requisicao.method() === "PATCH")
      patches.push({ url: requisicao.url(), corpo: requisicao.postDataJSON() });
  });
  const coluna = (status) => page.locator(`[data-status-column="${status}"]`);
  const cartao = (id) => page.locator(`[data-task-id="${id}"]`);
  const lerTarefa = async (id) => (await fetch(`${api}/tarefas/${id}`)).json();
  const [alvo, outra] = seed.tarefas.filter((t) => t.status === "a-fazer");
  const PEGAR = { sourcePosition: { x: 24, y: 70 } };

  await page.goto(`${web}/quadro`);
  await cartao(alvo.id).waitFor();
  assert.equal(await cartao(alvo.id).getAttribute("draggable"), "true");

  await cartao(alvo.id).locator(".e-task-title").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(`**/tarefas/${alvo.id}`);
  assert.equal(
    await cartao(alvo.id)
      .getAttribute("class")
      .then((c) => c.includes("e-card-arrastando")),
    false,
  );
  await page.goto(`${web}/quadro`);
  await cartao(alvo.id).waitFor();
  console.log("OK: Enter no título abre a tarefa em vez de arrastar");

  await cartao(alvo.id).dragTo(coluna("em-revisao"), PEGAR);
  await coluna("em-revisao").locator(`[data-task-id="${alvo.id}"]`).waitFor();
  assert.equal(
    await coluna("a-fazer").locator(`[data-task-id="${alvo.id}"]`).count(),
    0,
  );
  const statusGravado = patches.findIndex(
    (patch) => patch.corpo.status === "em-revisao",
  );
  assert.ok(statusGravado >= 0);
  assert.ok(
    patches.every(
      (patch, indice) => !("ordem" in patch.corpo) || indice > statusGravado,
    ),
  );
  assert.equal((await lerTarefa(alvo.id)).status, "em-revisao");
  await page
    .locator("main p[role=status]")
    .filter({ hasText: `Status de ${alvo.titulo} alterado para Em revisão.` })
    .waitFor({ state: "attached" });
  console.log("OK: arrastar para outra coluna grava e anuncia o novo status");

  const antes = patches.length;
  await cartao(outra.id).dragTo(coluna("a-fazer"), PEGAR);
  await page.waitForTimeout(300);
  assert.ok(patches.slice(antes).every((patch) => !("status" in patch.corpo)));
  assert.equal(
    await coluna("a-fazer").locator(`[data-task-id="${outra.id}"]`).count(),
    1,
  );
  console.log("OK: soltar na mesma coluna não muda o status");

  await page.route(`${api}/tarefas/${outra.id}`, (rota) =>
    rota.request().method() === "PATCH"
      ? rota.fulfill({ status: 500, body: "{}" })
      : rota.continue(),
  );
  const antesDaFalha = patches.length;
  await cartao(outra.id).dragTo(coluna("concluida"), PEGAR);
  await cartao(outra.id).locator("[role=alert]").waitFor();
  assert.equal(
    await coluna("a-fazer").locator(`[data-task-id="${outra.id}"]`).count(),
    1,
  );
  assert.equal((await lerTarefa(outra.id)).status, "a-fazer");
  await page.waitForTimeout(300);
  assert.ok(
    patches.slice(antesDaFalha).every((patch) => !("ordem" in patch.corpo)),
  );
  await page.unroute(`${api}/tarefas/${outra.id}`);
  console.log(
    "OK: falha ao gravar o status mantém o cartão, mostra o erro e não grava a ordem",
  );

  await cartao(outra.id).dragTo(coluna("concluida"), PEGAR);
  await coluna("concluida").locator(`[data-task-id="${outra.id}"]`).waitFor();
  assert.equal(await cartao(outra.id).locator("[role=alert]").count(), 0);
  console.log("OK: nova tentativa depois do erro funciona");

  const idsNaColuna = (status) =>
    coluna(status)
      .locator("[data-task-id]")
      .evaluateAll((cartoes) =>
        cartoes.map((c) => c.getAttribute("data-task-id")),
      );
  const ordemSalva = async (status) =>
    (await (await fetch(`${api}/tarefas`)).json())
      .filter((t) => t.status === status)
      .sort(
        (a, b) =>
          (a.ordem ?? Number.MAX_SAFE_INTEGER) -
          (b.ordem ?? Number.MAX_SAFE_INTEGER),
      )
      .map((t) => t.id);
  const original = await idsNaColuna("em-revisao");
  assert.ok(original.length >= 2);
  const [primeiro] = original;
  const ultimo = original.at(-1);
  const alertaOrdem = page
    .locator("main p[role=alert]")
    .filter({ hasText: "Não foi possível salvar a nova ordem." });
  await page.route(`${api}/tarefas/${ultimo}`, (rota) =>
    rota.request().method() === "PATCH"
      ? rota.fulfill({ status: 500, body: "{}" })
      : rota.continue(),
  );
  await cartao(ultimo).dragTo(cartao(primeiro), {
    ...PEGAR,
    targetPosition: { x: 24, y: 4 },
  });
  await alertaOrdem.waitFor();
  await page.waitForFunction(
    async ([status, esperado]) =>
      JSON.stringify(
        [
          ...document.querySelectorAll(
            `[data-status-column="${status}"] [data-task-id]`,
          ),
        ].map((c) => c.getAttribute("data-task-id")),
      ) === esperado,
    ["em-revisao", JSON.stringify(await ordemSalva("em-revisao"))],
  );
  assert.equal((await idsNaColuna("em-revisao"))[0], primeiro);
  await page.unroute(`${api}/tarefas/${ultimo}`);
  console.log("OK: falha ao salvar a ordem avisa e volta à ordem salva");

  await cartao(ultimo).dragTo(cartao(primeiro), {
    ...PEGAR,
    targetPosition: { x: 24, y: 4 },
  });
  await page.waitForFunction(
    (id) =>
      document
        .querySelector('[data-status-column="em-revisao"] [data-task-id]')
        ?.getAttribute("data-task-id") === id,
    ultimo,
  );
  assert.equal(await alertaOrdem.count(), 0);
  await page.waitForTimeout(300);
  assert.deepEqual(
    await ordemSalva("em-revisao"),
    await idsNaColuna("em-revisao"),
  );
  console.log("OK: nova tentativa de reordenar salva e tira o aviso");

  const salvaAntesDeSair = await ordemSalva("em-revisao");
  await page.locator('a[href="/projetos"]').first().click();
  await page.waitForURL("**/projetos");
  await page.route(`${api}/tarefas*`, async (rota) => {
    if (rota.request().method() === "GET")
      await new Promise((pronto) => setTimeout(pronto, 1500));
    await rota.continue();
  });
  await page.goBack();
  await coluna("em-revisao").locator("[data-task-id]").first().waitFor();
  assert.deepEqual(await idsNaColuna("em-revisao"), salvaAntesDeSair);
  await page.unroute(`${api}/tarefas*`);
  console.log("OK: voltar ao quadro mostra a ordem nova antes de recarregar");

  await page.goto(`${web}/`);
  await page.locator(".e-row").first().waitFor();
  assert.equal(await page.locator('.e-row[draggable="true"]').count(), 0);
  console.log("OK: lista não fica arrastável");

  assert.deepEqual(errosJs, []);
  console.log("Cenários de arrastar no quadro aprovados.");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
