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
  const tarefas = JSON.parse(seedOriginal).tarefas;
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-exclusao-" });
  const { api, web } = await apoio.subirAmbiente({ banco });

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const exclusoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (requisicao) => {
    if (requisicao.method() === "DELETE") exclusoes.push(requisicao.url());
  });
  const cartao = (tarefa) => page.locator(`[data-task-id="${tarefa.id}"]`);
  const dialogo = (tarefa) =>
    page.getByRole("dialog", { name: `Excluir ${tarefa.titulo}` });
  const abrir = async (tarefa) => {
    await cartao(tarefa)
      .getByRole("button", { name: `Ações de ${tarefa.titulo}` })
      .click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    await dialogo(tarefa).waitFor();
  };
  const confirmar = async (tarefa) =>
    dialogo(tarefa).getByRole("button", { name: "Excluir tarefa" }).click();
  const existeNaApi = async (tarefa) =>
    (await fetch(`${api}/tarefas/${tarefa.id}`)).ok;
  const [naLista, noQuadro, noProjeto] = tarefas;

  await page.goto(web);
  await cartao(naLista).waitFor();
  await abrir(naLista);
  assert.match(await dialogo(naLista).innerText(), /não pode ser desfeita/);
  await dialogo(naLista).getByRole("button", { name: "Cancelar" }).click();
  await dialogo(naLista).waitFor({ state: "detached" });
  assert.equal(exclusoes.length, 0);
  assert.equal(await cartao(naLista).count(), 1);
  assert.equal(await existeNaApi(naLista), true);
  console.log("OK: cancelar mantém a tarefa na lista e não chama DELETE");

  const urlFalha = `${api}/tarefas/${naLista.id}`;
  await page.route(urlFalha, (rota) =>
    rota.request().method() === "DELETE"
      ? rota.fulfill({ status: 500, body: "{}" })
      : rota.continue(),
  );
  await abrir(naLista);
  await confirmar(naLista);
  await dialogo(naLista).getByRole("alert").waitFor();
  assert.equal(await cartao(naLista).count(), 1);
  assert.equal(await existeNaApi(naLista), true);
  assert.equal(
    await page.locator(".e-sheet-footer").innerText(),
    `${tarefas.length} tarefas`,
  );
  await page.unroute(urlFalha);
  console.log("OK: falha da API avisa e mantém a tarefa e a contagem");

  await confirmar(naLista);
  await cartao(naLista).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(naLista), false);
  assert.equal(
    await page.locator(".e-sheet-footer").innerText(),
    `${tarefas.length - 1} tarefas`,
  );
  await page.reload();
  await page.getByRole("region", { name: "Lista de tarefas" }).waitFor();
  assert.equal(await cartao(naLista).count(), 0);
  console.log(
    "OK: sucesso remove da API, da lista e do rodapé, inclusive após recarregar",
  );

  await page.goto(`${web}/quadro`);
  await cartao(noQuadro).waitFor();
  await abrir(noQuadro);
  await confirmar(noQuadro);
  await cartao(noQuadro).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(noQuadro), false);
  assert.equal(
    await page.locator(".e-sheet-footer").innerText(),
    `${tarefas.length - 2} tarefas`,
  );
  console.log("OK: exclusão também atualiza o quadro");

  await page.goto(`${web}/projetos/${noProjeto.projetoId}`);
  await cartao(noProjeto).waitFor();
  const totalProjeto = await page.locator(".e-list [data-task-id]").count();
  await abrir(noProjeto);
  await confirmar(noProjeto);
  await cartao(noProjeto).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(noProjeto), false);
  assert.equal(
    await page.locator(".e-sheet-footer").innerText(),
    `${totalProjeto - 1} ${totalProjeto - 1 === 1 ? "tarefa" : "tarefas"}`,
  );
  console.log("OK: exclusão também atualiza a página do projeto");

  const unica = tarefas[3];
  await page.goto(web);
  await cartao(unica).waitFor();
  await page.locator(".e-task-search input").fill(unica.titulo);
  await page.waitForFunction(
    () => document.querySelectorAll("[data-task-id]").length === 1,
  );
  await abrir(unica);
  await confirmar(unica);
  await cartao(unica).waitFor({ state: "detached" });
  await page.waitForFunction(
    () => document.activeElement?.closest(".e-task-search") !== null,
  );
  assert.equal(
    await page.evaluate(() => {
      const caixa = document.activeElement.getBoundingClientRect();
      return caixa.width > 1 && caixa.height > 1;
    }),
    true,
  );
  console.log(
    "OK: excluir o único resultado da busca leva o foco à busca, visível",
  );

  const criar = async (titulo) =>
    (
      await fetch(`${api}/tarefas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projetoId: "1",
          titulo,
          descricao: "",
          status: "a-fazer",
          prioridade: "media",
          responsavel: "Ana",
          prazo: "2026-12-01",
        }),
      })
    ).json();
  const pelaFicha = [];
  for (let n = 1; n <= 4; n++)
    pelaFicha.push(await criar(`Excluir pela ficha ${n}`));
  const [daLista, doQuadro, doProjeto, direta] = pelaFicha;
  let restantes = tarefas.length - 4 + pelaFicha.length;
  const ficha = page.getByRole("dialog", { name: "Detalhes da tarefa" });
  const botaoFicha = ficha.getByRole("button", { name: "Excluir tarefa" });
  const rodape = page.locator(".e-sheet-footer");
  const total = (n) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;
  const abrirFicha = async (tarefa) => {
    await cartao(tarefa).locator(".e-task-title").click();
    await ficha.locator(".e-read-title").waitFor();
  };
  const vizinhoDe = (tarefa) =>
    page.evaluate((id) => {
      const cartoes = [...document.querySelectorAll("[data-task-id]")];
      const posicao = cartoes.findIndex(
        (cartao) => cartao.dataset.taskId === id,
      );
      return (cartoes[posicao + 1] ?? cartoes[posicao - 1])?.dataset.taskId;
    }, tarefa.id);
  const focoNoTitulo = (id) =>
    page.waitForFunction(
      (alvo) =>
        document.activeElement?.matches(".e-task-title") &&
        document.activeElement.closest("[data-task-id]")?.dataset.taskId ===
          alvo,
      id,
    );
  const anunciado = (tarefa) =>
    page.waitForFunction(
      (texto) =>
        [...document.querySelectorAll("main p[role=status]")].some(
          (p) => p.textContent === texto,
        ),
      `Tarefa ${tarefa.titulo} excluída.`,
    );

  await page.goto(web);
  await cartao(daLista).waitFor();
  assert.equal(await rodape.innerText(), total(restantes));
  await abrirFicha(daLista);
  assert.deepEqual(await ficha.locator("footer button").allInnerTexts(), [
    "Excluir tarefa",
    "Editar tarefa",
  ]);
  await botaoFicha.click();
  await dialogo(daLista).waitFor();
  assert.match(
    await dialogo(daLista).innerText(),
    /Excluir tarefa\?[\s\S]*“Excluir pela ficha 1”\? Esta ação não pode ser desfeita\./,
  );
  await dialogo(daLista).getByRole("button", { name: "Cancelar" }).click();
  await dialogo(daLista).waitFor({ state: "detached" });
  await page.waitForFunction(
    () =>
      document.activeElement?.textContent === "Excluir tarefa" &&
      document.activeElement.closest(".e-read-task") !== null,
  );
  assert.equal(await ficha.count(), 1);
  assert.equal(
    exclusoes.filter((url) => url.endsWith(`/${daLista.id}`)).length,
    0,
  );
  console.log(
    "OK: na ficha, Excluir tarefa abre a mesma confirmação; cancelar mantém a ficha e devolve o foco ao botão",
  );

  const urlDaLista = `${api}/tarefas/${daLista.id}`;
  let decidir;
  const decisao = new Promise((resolve) => {
    decidir = resolve;
  });
  await page.route(urlDaLista, async (rota) =>
    rota.request().method() === "DELETE" && (await decisao) === 500
      ? rota.fulfill({ status: 500, body: "{}" })
      : rota.continue(),
  );
  await botaoFicha.click();
  await confirmar(daLista);
  await dialogo(daLista).getByRole("button", { name: "Excluindo…" }).waitFor();
  assert.equal(
    await ficha
      .getByRole("button", { name: "Fechar detalhes da tarefa" })
      .isDisabled(),
    true,
  );
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(await dialogo(daLista).count(), 1);
  assert.equal(await ficha.count(), 1);
  decidir(500);
  await dialogo(daLista).getByRole("alert").waitFor();
  assert.equal(
    await dialogo(daLista).getByRole("alert").innerText(),
    "Não foi possível excluir a tarefa. Tente de novo.",
  );
  assert.equal(await cartao(daLista).count(), 1);
  assert.equal(await existeNaApi(daLista), true);
  assert.equal(await rodape.innerText(), total(restantes));
  await page.unroute(urlDaLista);
  console.log(
    "OK: na ficha, com o DELETE pendente nada fecha; a falha avisa e mantém tarefa, ficha e contagem",
  );

  const vizinhoDaLista = await vizinhoDe(daLista);
  await confirmar(daLista);
  await ficha.waitFor({ state: "detached" });
  await cartao(daLista).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(daLista), false);
  assert.equal(await rodape.innerText(), total(--restantes));
  assert.equal(new URL(page.url()).pathname, "/");
  await focoNoTitulo(vizinhoDaLista);
  await anunciado(daLista);
  console.log(
    "OK: na ficha, o sucesso fecha a ficha, tira a tarefa da lista e do rodapé, anuncia e leva o foco ao cartão vizinho",
  );

  await page.goto(`${web}/quadro`);
  await abrirFicha(doQuadro);
  await botaoFicha.click();
  await dialogo(doQuadro)
    .getByRole("button", { name: "Excluir tarefa" })
    .dblclick();
  await ficha.waitFor({ state: "detached" });
  await cartao(doQuadro).waitFor({ state: "detached" });
  assert.equal(
    exclusoes.filter((url) => url.endsWith(`/${doQuadro.id}`)).length,
    1,
  );
  assert.equal(await rodape.innerText(), total(--restantes));
  await anunciado(doQuadro);
  assert.notEqual(
    await page.evaluate(() => document.activeElement === document.body),
    true,
  );
  console.log(
    "OK: na ficha sobre o quadro, duplo clique gera um só DELETE e o cartão sai do quadro e da contagem",
  );

  await page.goto(`${web}/projetos/1`);
  await cartao(doProjeto).waitFor();
  const noProjetoAntes = await page.locator(".e-list [data-task-id]").count();
  const urlDoProjeto = `${api}/tarefas/${doProjeto.id}`;
  await page.route(urlDoProjeto, (rota) =>
    rota.request().method() === "DELETE"
      ? rota.fulfill({ status: 404, body: "{}" })
      : rota.continue(),
  );
  await abrirFicha(doProjeto);
  await botaoFicha.click();
  await confirmar(doProjeto);
  await ficha.waitFor({ state: "detached" });
  await cartao(doProjeto).waitFor({ state: "detached" });
  await page.unroute(urlDoProjeto);
  assert.equal(await rodape.innerText(), total(noProjetoAntes - 1));
  assert.equal(new URL(page.url()).pathname, "/projetos/1");
  await anunciado(doProjeto);
  assert.notEqual(
    await page.evaluate(() => document.activeElement === document.body),
    true,
  );
  await fetch(urlDoProjeto, { method: "DELETE" });
  console.log(
    "OK: na ficha sobre o projeto, o 404 conta como sucesso e o cartão sai da página e do rodapé",
  );

  await page.goto(`${web}/tarefas/${direta.id}`);
  await ficha.locator(".e-read-title").waitFor();
  await botaoFicha.click();
  await confirmar(direta);
  await ficha.waitFor({ state: "detached" });
  await cartao(direta).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(direta), false);
  assert.equal(await rodape.innerText(), total(restantes - 2));
  await page.waitForFunction(() => {
    const ativo = document.activeElement;
    const caixa = ativo?.getBoundingClientRect();
    return (
      ativo && ativo !== document.body && caixa.width > 1 && caixa.height > 1
    );
  });
  console.log(
    "OK: na ficha aberta pelo endereço, excluir volta à lista sem a tarefa e com o foco num lugar visível",
  );

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(
    await readFile(join(raiz, "db.seed.json"), "utf8"),
    seedOriginal,
  );
  console.log("OK: sem erros JavaScript e sem alterações nos bancos locais");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
