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
  assert.deepEqual(patches.at(-1).corpo, { status: "em-revisao" });
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
  await cartao(outra.id).dragTo(coluna("concluida"), PEGAR);
  await cartao(outra.id).locator("[role=alert]").waitFor();
  assert.equal(
    await coluna("a-fazer").locator(`[data-task-id="${outra.id}"]`).count(),
    1,
  );
  assert.equal((await lerTarefa(outra.id)).status, "a-fazer");
  await page.unroute(`${api}/tarefas/${outra.id}`);
  console.log("OK: falha ao gravar mantém o cartão na coluna e mostra o erro");

  await cartao(outra.id).dragTo(coluna("concluida"), PEGAR);
  await coluna("concluida").locator(`[data-task-id="${outra.id}"]`).waitFor();
  assert.equal(await cartao(outra.id).locator("[role=alert]").count(), 0);
  console.log("OK: nova tentativa depois do erro funciona");

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
