const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { criarUi, lancarNavegador } = require("./ui.cjs");

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
  temporario = await mkdtemp(join(tmpdir(), "pixel-ficha-"));
  const originais = await Promise.all(["db.json", "db.seed.json"].map((arquivo) => readFile(arquivo, "utf8")));
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

  const lerTarefa = async (id) => (await fetch(`${api}/tarefas/${id}`)).json();
  const { campo } = criarUi(page);
  const modal = page.locator(".e-form-modal");
  const titulo = page.locator(".e-form-header h2");
  // A entrada anima e o conteúdo carrega depois: espera a caixa parar antes de medir.
  // Detalhes e Editar têm alturas diferentes, então a posição é x, y e largura.
  const caixaEstavel = async () => {
    let anterior = await modal.boundingBox();
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(120);
      const atual = await modal.boundingBox();
      if (JSON.stringify(atual) === JSON.stringify(anterior)) return { x: atual.x, y: atual.y, width: atual.width };
      anterior = atual;
    }
    throw new Error("A ficha não assentou");
  };
  const arrastar = async (dx, dy) => {
    const t = await titulo.boundingBox();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2 + dx, t.y + t.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  };
  const overlay = page.locator(".e-form-overlay");
  const filtro = () => overlay.evaluate((el) => getComputedStyle(el).backdropFilter);
  // A transição de 0,2 s deixa o valor calculado em trânsito por instantes: espera assentar.
  const filtroFinal = async (esperado) => {
    await page.waitForFunction(([seletor, valor]) => getComputedStyle(document.querySelector(seletor)).backdropFilter === valor, [".e-form-overlay", esperado]);
    assert.equal(await filtro(), esperado);
  };

  // Desfoque só na edição: detalhes, nova tarefa e novo projeto ficam sem filtro.
  await page.goto(`${web}/quadro`);
  await page.locator("[data-task-id]").first().waitFor();
  await page.locator('[data-task-id="1"] .e-task-title').click();
  await page.getByRole("dialog", { name: "Detalhes da tarefa" }).waitFor();
  await filtroFinal("none");
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).waitFor();
  const origemDetalhes = await caixaEstavel();
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
  await page.getByRole("dialog", { name: "Editar tarefa" }).waitFor();
  await filtroFinal("blur(3px)");
  await page.goto(`${web}/tarefas/nova`);
  await page.getByRole("dialog", { name: "Nova tarefa" }).waitFor();
  await filtroFinal("none");
  await page.goto(`${web}/projetos/novo`);
  await page.getByRole("dialog", { name: "Novo projeto" }).waitFor();
  await filtroFinal("none");
  await page.goto(`${web}/projetos/1/editar`);
  await page.getByRole("dialog", { name: "Editar projeto" }).waitFor();
  await filtroFinal("blur(3px)");
  console.log("OK: o fundo só é desfocado na edição");

  // Volta à edição de tarefa para exercitar o movimento.
  await page.goto(`${web}/quadro`);
  await page.locator('[data-task-id="1"] .e-task-title').click();
  await page.getByRole("dialog", { name: "Detalhes da tarefa" }).waitFor();
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
  await page.getByRole("dialog", { name: "Editar tarefa" }).waitFor();
  await campo("Título").waitFor();
  const inicio = await caixaEstavel();
  const t0 = await titulo.boundingBox();
  await page.mouse.move(t0.x + t0.width / 2, t0.y + t0.height / 2);
  await page.mouse.down();
  await page.mouse.move(t0.x + t0.width / 2 - 10, t0.y + t0.height / 2, { steps: 2 });
  assert.equal(await modal.getAttribute("data-arrastando"), "true");
  await page.mouse.up();
  assert.equal(await modal.getAttribute("data-arrastando"), null);
  await titulo.dblclick();
  await arrastar(-300, 120);
  const movida = await caixaEstavel();
  assert.ok(Math.abs(movida.x - (inicio.x - 300)) <= 1 && Math.abs(movida.y - (inicio.y + 120)) <= 1);
  await arrastar(-5000, -5000);
  let caixa = await caixaEstavel();
  assert.ok(caixa.x >= 8 - 1 && caixa.y >= 8 - 1);
  await arrastar(5000, 5000);
  caixa = await caixaEstavel();
  assert.ok(caixa.x + caixa.width <= 1280 - 8 + 1 && caixa.y <= 900 - 56 + 1);
  assert.equal(await page.getByRole("dialog", { name: "Editar tarefa" }).count(), 1);
  await titulo.dblclick();
  assert.deepEqual(await caixaEstavel(), inicio);
  console.log("OK: a ficha é arrastada pelo cabeçalho, respeita os limites e volta com duplo clique");

  // Redimensionar a janela devolve a ficha à posição original.
  await arrastar(-150, 40);
  await page.setViewportSize({ width: 1300, height: 900 });
  const aposRedimensionar = await caixaEstavel();
  await titulo.dblclick();
  assert.deepEqual(await caixaEstavel(), aposRedimensionar);
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log("OK: redimensionar a janela devolve a ficha à posição original");

  await arrastar(-200, 0);
  const antesDeSalvar = await caixaEstavel();
  await campo("Título").fill("Criar o repositório (movida)");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await page.getByRole("dialog", { name: "Detalhes da tarefa" }).waitFor();
  assert.deepEqual(await caixaEstavel(), antesDeSalvar);
  assert.equal((await lerTarefa("1")).titulo, "Criar o repositório (movida)");
  const fechar = page.getByRole("button", { name: /^Fechar/ });
  const b = await fechar.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x - 100, b.y + 50, { steps: 5 }); await page.mouse.up();
  assert.deepEqual(await caixaEstavel(), antesDeSalvar);
  await fechar.click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.locator('[data-task-id="1"] .e-task-title').click();
  await page.getByRole("dialog", { name: "Detalhes da tarefa" }).waitFor();
  assert.deepEqual(await caixaEstavel(), origemDetalhes);
  console.log("OK: a posição persiste entre Detalhes e Editar e volta ao original ao reabrir");

  // Celular: a ficha é uma folha presa embaixo e não se move.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Editar tarefa", exact: true }).click();
  await page.getByRole("dialog", { name: "Editar tarefa" }).waitFor();
  const celular = await caixaEstavel();
  await arrastar(0, -200);
  assert.deepEqual(await caixaEstavel(), celular);
  await page.setViewportSize({ width: 1280, height: 900 });
  console.log("OK: no celular a ficha não se move");

  assert.deepEqual(errosJs, []);
  const atuais = await Promise.all(["db.json", "db.seed.json"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(atuais, originais);
  console.log("5 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
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
