const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { contraste, focoVisivel, lancarNavegador, TEXTO_STATUS } = require("./ui.cjs");

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function pronto(url) {
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(processos, argumentos, env = process.env) {
  const processo = spawn(process.execPath, argumentos, { windowsHide: true, stdio: "pipe", env });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (erro) => process.stderr.write(erro));
  processos.push(processo);
}

let browser;
let temporario;
const processos = [];

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-status-"));
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  const evidencias = process.env.STATUS_EVIDENCIAS;
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar(processos, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);
  const patches = [];
  page.on("request", (requisicao) => { if (requisicao.method() === "PATCH") patches.push({ url: requisicao.url(), corpo: requisicao.postDataJSON() }); });
  const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
  const lista = page.getByRole("region", { name: "Lista de tarefas" });
  const coluna = (status) => page.locator(`[data-status-column="${status}"]`);
  const cartao = (id) => page.locator(`[data-task-id="${id}"]`);
  const seletorDe = (tarefa) => page.getByRole("button", { name: new RegExp(`^Mudar status de ${tarefa.titulo} \\(atual:`) });
  // O React Aria nomeia o menu pelo botão que o abre.
  const menuDe = (tarefa) => page.getByRole("menu", { name: new RegExp(`^Mudar status de ${tarefa.titulo}`) });
  const opcao = (tarefa, status) => menuDe(tarefa).getByRole("menuitemradio", { name: TEXTO_STATUS[status], exact: true });
  const anuncio = page.locator("main p[role=status]");
  const rodape = page.locator(".e-sheet-footer");
  const busca = page.getByRole("searchbox", { name: "Buscar por título" });
  const filtro = (nome) => page.locator(".e-task-filters").getByRole("button", { name: new RegExp(nome) });
  const selecionarFiltro = async (nome, valor) => {
    await filtro(nome).click();
    const item = page.getByRole("option", { name: valor, exact: true });
    await item.click();
    await item.waitFor({ state: "detached" });
  };
  const lerTarefa = async (id) => (await fetch(`${api}/tarefas/${id}`)).json();
  const tarefasNaTela = (id) => page.locator(`[data-task-id="${id}"]`).count();
  const textoTotal = (n) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;
  const focoNoSeletor = (id) => page.waitForFunction((alvo) => document.activeElement?.hasAttribute("data-status-trigger") && document.activeElement.closest("[data-task-id]")?.dataset.taskId === alvo, id);
  const escolher = async (tarefa, status) => {
    await seletorDe(tarefa).click();
    await opcao(tarefa, status).click();
  };
  // Segura o PATCH da tarefa no navegador até `liberar` decidir entre deixar passar e responder 500.
  const segurarPatch = async (id) => {
    let decidir;
    const decisao = new Promise((resolve) => { decidir = resolve; });
    const url = `${api}/tarefas/${id}`;
    await page.route(url, async (rota) => {
      if (rota.request().method() !== "PATCH") return rota.continue();
      if ((await decisao) === 500) await rota.fulfill({ status: 500, body: "{}" });
      else await rota.continue();
    });
    return async (resposta) => {
      const respondeu = page.waitForResponse((r) => r.url() === url && r.request().method() === "PATCH");
      decidir(resposta);
      await respondeu;
      await page.unroute(url);
    };
  };
  const conferirMenu = async (tarefa) => {
    await seletorDe(tarefa).click();
    await menuDe(tarefa).waitFor();
    assert.deepEqual(await menuDe(tarefa).getByRole("menuitemradio").allInnerTexts(), Object.values(TEXTO_STATUS));
    assert.equal(await menuDe(tarefa).getByRole("menuitemradio", { checked: true }).innerText(), TEXTO_STATUS[tarefa.status]);
    await page.keyboard.press("Escape");
    await menuDe(tarefa).waitFor({ state: "detached" });
  };

  const [alvo, outra] = seed.tarefas.filter((t) => t.status === "a-fazer");
  const total = seed.tarefas.length;

  // Seletor no quadro e na lista; na página do projeto o selo segue só informativo.
  await page.goto(`${web}/quadro`);
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(await page.locator("[data-status-trigger]").count(), total);
  assert.equal(await seletorDe(alvo).innerText(), TEXTO_STATUS["a-fazer"]);
  await conferirMenu(alvo);
  await page.goto(`${web}/`);
  await lista.getByRole("article").first().waitFor();
  assert.equal(await page.locator("[data-status-trigger]").count(), total);
  await conferirMenu(alvo);
  await page.goto(`${web}/projetos/${alvo.projetoId}`);
  await cartao(alvo.id).waitFor();
  assert.equal(await page.locator("[data-status-trigger]").count(), 0);
  assert.equal(await cartao(alvo.id).locator(".e-status").innerText(), TEXTO_STATUS["a-fazer"]);
  console.log("OK: quadro e lista abrem o menu com os quatro status e o atual marcado; o projeto mostra só o selo");

  // Quadro: grava só o status e o cartão muda de coluna, sem duplicar, com contadores e rodapé coerentes.
  await page.goto(`${web}/quadro`);
  await quadro.locator("[data-task-id]").first().waitFor();
  const contar = async (status) => Number(await coluna(status).locator("h2 > span:last-child").innerText());
  const [antesAFazer, antesConcluida] = [await contar("a-fazer"), await contar("concluida")];
  await escolher(alvo, "concluida");
  await coluna("concluida").locator(`[data-task-id="${alvo.id}"]`).waitFor();
  assert.equal(await tarefasNaTela(alvo.id), 1);
  assert.deepEqual([await contar("a-fazer"), await contar("concluida")], [antesAFazer - 1, antesConcluida + 1]);
  assert.equal(await rodape.innerText(), textoTotal(total));
  assert.deepEqual(patches.at(-1), { url: `${api}/tarefas/${alvo.id}`, corpo: { status: "concluida" } });
  assert.deepEqual(await lerTarefa(alvo.id), { ...alvo, status: "concluida" });
  assert.equal(await seletorDe(alvo).innerText(), TEXTO_STATUS.concluida);
  console.log("OK: no quadro, o PATCH grava só o status e o cartão vai, uma única vez, para a coluna nova");

  // Foco segue o cartão até a coluna nova; o anúncio confirma a mudança e fica fora da tela.
  await focoNoSeletor(alvo.id);
  assert.equal(await anuncio.innerText(), `Status de ${alvo.titulo} alterado para ${TEXTO_STATUS.concluida}.`);
  const caixaAnuncio = await anuncio.boundingBox();
  assert.ok(caixaAnuncio.width <= 1 && caixaAnuncio.height <= 1, `anúncio visível: ${JSON.stringify(caixaAnuncio)}`);
  console.log("OK: o foco volta ao seletor do cartão movido e a mudança é anunciada só ao leitor de tela");

  // Teclado: Enter abre o menu, a seta desce até "Em andamento" e Enter confirma.
  await seletorDe(alvo).focus();
  await page.keyboard.press("Enter");
  await menuDe(alvo).waitFor();
  for (let passo = 0; passo < 4 && !(await opcao(alvo, "em-andamento").evaluate((el) => el === document.activeElement)); passo++) await page.keyboard.press("ArrowDown");
  assert.equal(await opcao(alvo, "em-andamento").evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Enter");
  await coluna("em-andamento").locator(`[data-task-id="${alvo.id}"]`).waitFor();
  assert.equal((await lerTarefa(alvo.id)).status, "em-andamento");
  await focoNoSeletor(alvo.id);
  assert.equal(await focoVisivel(seletorDe(alvo)), true);
  console.log("OK: o seletor funciona só pelo teclado, com foco visível");

  // Escolher o status atual não chama a API.
  const semPatch = page.waitForRequest((r) => r.method() === "PATCH", { timeout: 1500 }).then(() => "houve PATCH", () => "nenhum PATCH");
  await seletorDe(alvo).click();
  await opcao(alvo, "em-andamento").click();
  await menuDe(alvo).waitFor({ state: "detached" });
  assert.equal(await semPatch, "nenhum PATCH");
  console.log("OK: escolher o status atual não chama a API");

  // Envio pendente: o botão trava, o cartão fica onde está e um segundo clique não sai; depois a falha avisa e devolve o foco.
  const anuncioAntes = await anuncio.innerText();
  let liberar = await segurarPatch(alvo.id);
  await seletorDe(alvo).focus();
  await page.keyboard.press("Enter");
  await menuDe(alvo).waitFor();
  for (let passo = 0; passo < 4 && !(await opcao(alvo, "em-revisao").evaluate((el) => el === document.activeElement)); passo++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("[data-pending][data-status-trigger]"));
  await menuDe(alvo).waitFor({ state: "detached" });
  await seletorDe(alvo).click({ force: true });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await menuDe(alvo).count(), 0);
  assert.equal(await coluna("em-andamento").locator(`[data-task-id="${alvo.id}"]`).count(), 1);
  assert.equal(await tarefasNaTela(alvo.id), 1);
  const patchesPendentes = patches.length;
  await liberar(500);
  await cartao(alvo.id).getByRole("alert").waitFor();
  assert.match(await cartao(alvo.id).getByRole("alert").innerText(), /Não foi possível mudar o status/);
  assert.equal(patches.length, patchesPendentes);
  assert.equal(await coluna("em-andamento").locator(`[data-task-id="${alvo.id}"]`).count(), 1);
  assert.equal(await tarefasNaTela(alvo.id), 1);
  assert.equal((await lerTarefa(alvo.id)).status, "em-andamento");
  assert.equal(await anuncio.innerText(), anuncioAntes);
  assert.equal(await seletorDe(alvo).getAttribute("data-pending"), null);
  await focoNoSeletor(alvo.id);
  await escolher(alvo, "em-revisao");
  await coluna("em-revisao").locator(`[data-task-id="${alvo.id}"]`).waitFor();
  assert.equal(await cartao(alvo.id).getByRole("alert").count(), 0);
  console.log("OK: com o PATCH pendente o seletor trava; a falha não move o cartão, avisa, devolve o foco e permite tentar de novo");

  // Resposta atrasada não tira o foco de quem já foi digitar na busca.
  liberar = await segurarPatch(outra.id);
  await escolher(outra, "em-andamento");
  await busca.click();
  await busca.pressSequentially("Des");
  await liberar("continuar");
  await coluna("em-andamento").locator(`[data-task-id="${outra.id}"]`).waitFor();
  assert.equal(await busca.evaluate((el) => el === document.activeElement), true);
  await busca.fill("");
  console.log("OK: a resposta atrasada move o cartão sem roubar o foco da busca");

  // Trocar de visão com a resposta pendente: a lista recém-aberta recebe o status gravado.
  liberar = await segurarPatch(outra.id);
  await escolher(outra, "concluida");
  await page.getByRole("navigation", { name: "Visualização das tarefas" }).getByRole("link", { name: "Lista", exact: true }).click();
  await lista.getByRole("article").first().waitFor();
  assert.equal(await seletorDe(outra).innerText(), TEXTO_STATUS["em-andamento"]);
  await liberar("continuar");
  await page.waitForFunction(([id, texto]) => document.querySelector(`[data-task-id="${id}"] [data-status-trigger]`)?.textContent === texto, [outra.id, TEXTO_STATUS.concluida]);
  assert.equal((await lerTarefa(outra.id)).status, "concluida");
  console.log("OK: trocar de visão com o PATCH pendente não deixa a lista com o status antigo");

  // Lista com filtros: prioridade e busca que continuam valendo mantêm o cartão; o filtro de status o tira da tela.
  await selecionarFiltro("Prioridade", "Média");
  await cartao("1").waitFor({ state: "detached" });
  const medias = seed.tarefas.filter((t) => t.prioridade === "media").length;
  assert.equal(await rodape.innerText(), textoTotal(medias));
  await busca.fill("tela");
  await cartao("3").waitFor({ state: "detached" });
  assert.equal(await rodape.innerText(), textoTotal(1));
  await escolher(alvo, "a-fazer");
  await page.waitForFunction(([id, texto]) => document.querySelector(`[data-task-id="${id}"] [data-status-trigger]`)?.textContent === texto, [alvo.id, TEXTO_STATUS["a-fazer"]]);
  assert.equal(await rodape.innerText(), textoTotal(1));
  assert.equal(await tarefasNaTela(alvo.id), 1);
  await busca.fill("");
  await selecionarFiltro("Prioridade", "Todas as prioridades");
  await selecionarFiltro("Status", "A fazer");
  await cartao("1").waitFor({ state: "detached" });
  const aFazer = (await lista.locator("[data-task-id]").count());
  await escolher(alvo, "concluida");
  await cartao(alvo.id).waitFor({ state: "detached" });
  assert.equal(await rodape.innerText(), textoTotal(aFazer - 1));
  assert.equal((await lerTarefa(alvo.id)).status, "concluida");
  // O cartão saiu da tela; o foco vai para o título da página em vez de cair no body.
  await page.waitForFunction(() => document.activeElement?.matches("main h1"));
  await selecionarFiltro("Status", "Todos os status");
  console.log("OK: na lista, prioridade e busca mantêm o cartão; o filtro de status o tira e o foco vai ao título");

  // Recarga, tema escuro e larguras.
  await page.goto(`${web}/quadro`);
  await quadro.locator("[data-task-id]").first().waitFor();
  assert.equal(await coluna("concluida").locator(`[data-task-id="${alvo.id}"]`).count(), 1);
  assert.equal(await coluna("concluida").locator(`[data-task-id="${outra.id}"]`).count(), 1);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.route(`${api}/tarefas/${alvo.id}`, (rota) => (rota.request().method() === "PATCH" ? rota.fulfill({ status: 500, body: "{}" }) : rota.continue()));
  await escolher(alvo, "a-fazer");
  const alerta = cartao(alvo.id).getByRole("alert");
  await alerta.waitFor();
  // O menu ainda sai com animação perto da borda; medir larguras com ele no DOM acusaria rolagem que não fica.
  await menuDe(alvo).waitFor({ state: "detached" });
  const cores = await alerta.evaluate((el) => ({ texto: getComputedStyle(el).color, fundo: getComputedStyle(el.closest(".e-card")).backgroundColor }));
  assert.ok(contraste(cores.texto, cores.fundo) >= 4.5, `alerta no escuro: ${cores.texto} sobre ${cores.fundo}`);
  if (evidencias) await page.screenshot({ path: join(evidencias, "status-quadro-escuro-erro.png") });
  await page.unroute(`${api}/tarefas/${alvo.id}`);
  await page.emulateMedia({ colorScheme: "light" });
  for (const largura of [850, 375, 320]) {
    await page.setViewportSize({ width: largura, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${largura} px`);
    const caixa = await seletorDe(outra).boundingBox();
    const folha = await page.locator(".e-sheet").boundingBox();
    assert.ok(caixa.x >= folha.x && caixa.x + caixa.width <= folha.x + folha.width, `${largura} px`);
    if (largura <= 650) {
      const toque = await seletorDe(outra).evaluate((el) => parseFloat(getComputedStyle(el, "::after").height));
      assert.ok(toque >= 44, `${largura} px: área de toque com ${toque} px`);
      await seletorDe(outra).click();
      for (const altura of await menuDe(outra).getByRole("menuitemradio").evaluateAll((itens) => itens.map((item) => item.getBoundingClientRect().height))) assert.ok(altura >= 44, `${largura} px: opção com ${altura} px`);
      if (evidencias) await page.screenshot({ path: join(evidencias, `status-quadro-menu-${largura}.png`) });
      await page.keyboard.press("Escape");
      await menuDe(outra).waitFor({ state: "detached" });
    }
  }
  console.log("OK: a recarga reflete a API; o alerta tem contraste no escuro; seletor e menu cabem de 850 a 320 px com toque de 44 px");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("10 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  for (const processo of processos) {
    if (processo.exitCode === null) {
      const terminou = new Promise((resolve) => processo.once("exit", resolve));
      processo.kill();
      await terminou;
    }
  }
  if (temporario) await rm(temporario, { recursive: true, force: true });
});
