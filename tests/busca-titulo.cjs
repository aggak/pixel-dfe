const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function pronto(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

async function executar() {
  const temporario = await mkdtemp(join(tmpdir(), "pixel-busca-"));
  const processos = [];
  let browser;
  try {
    const dados = JSON.parse(await readFile("db.seed.json", "utf8"));
    await copyFile("db.seed.json", join(temporario, "db.json"));
    const portaApi = await portaLivre();
    const portaWeb = await portaLivre();
    const api = `http://127.0.0.1:${portaApi}`;
    const web = `http://127.0.0.1:${portaWeb}`;
    processos.push(spawn(process.execPath, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)], { windowsHide: true, stdio: "pipe" }));
    processos.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: api } }));
    for (const processo of processos) processo.stderr.on("data", (erro) => process.stderr.write(erro));
    await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

    browser = await lancarNavegador();
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(web);
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    await lista.getByRole("article").first().waitFor();
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);

    const painel = await page.locator(".e-sheet").boundingBox();
    const campoDesktop = await busca.boundingBox();
    const acaoDesktop = await page.locator('[data-action="new-task"]').boundingBox();
    assert.ok(campoDesktop.x >= painel.x && campoDesktop.x < acaoDesktop.x);
    assert.ok(Math.abs(campoDesktop.y + campoDesktop.height - acaoDesktop.y - acaoDesktop.height) < 5);
    await page.setViewportSize({ width: 375, height: 800 });
    const campoCelular = await busca.boundingBox();
    const filtroCelular = await page.getByRole("button", { name: /Status/ }).boundingBox();
    const acaoCelular = await page.locator('[data-action="new-task"]').boundingBox();
    assert.ok(campoCelular.y < filtroCelular.y && filtroCelular.y < acaoCelular.y);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1280, height: 800 });

    await busca.focus();
    await page.keyboard.type("JSON");
    assert.equal(await lista.getByRole("article").count(), 1);
    await lista.getByRole("link", { name: "Subir o json-server" }).waitFor();
    assert.match(await page.locator(".e-sheet-footer").innerText(), /^1 tarefa$/);

    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    assert.equal(await page.getByRole("article").count(), 0);
    assert.match(await page.locator(".e-sheet-footer").innerText(), /^0 tarefas$/);

    await busca.press("ControlOrMeta+A");
    await busca.press("Backspace");
    await lista.getByRole("article").first().waitFor();
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);
    assert.equal(await busca.inputValue(), "");

    const selecionar = async (nome, opcao) => {
      await page.getByRole("button", { name: new RegExp(nome) }).click();
      await page.getByRole("option", { name: opcao, exact: true }).click();
    };
    await selecionar("Status", "A fazer");
    assert.equal(await lista.getByRole("article").count(), 2);
    await selecionar("Prioridade", "Média");
    assert.equal(await lista.getByRole("article").count(), 1);
    await lista.getByRole("link", { name: "Listar as tarefas na tela" }).waitFor();

    await busca.fill("LISTAR");
    assert.equal(await lista.getByRole("article").count(), 1);
    await busca.fill("json");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await busca.fill("");
    await lista.getByRole("link", { name: "Listar as tarefas na tela" }).waitFor();
    assert.equal(await lista.getByRole("article").count(), 1);

    await selecionar("Status", "Todos os status");
    assert.equal(await lista.getByRole("article").count(), 2);
    await selecionar("Prioridade", "Todas as prioridades");
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);

    await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Gerenciador de Tarefas" }).click();
    const projeto = page.getByRole("region", { name: "Tarefas do projeto" });
    await projeto.getByRole("article").first().waitFor();
    assert.equal(await projeto.getByRole("article").count(), dados.tarefas.filter((tarefa) => tarefa.projetoId === "1").length);
    await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Todas" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);
    console.log("OK: busca, filtros combinados, limpeza e abas de projeto");
  } finally {
    if (browser) await browser.close();
    for (const processo of processos) processo.kill();
    await rm(temporario, { recursive: true, force: true });
  }
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; });
