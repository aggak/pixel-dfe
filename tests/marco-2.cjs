const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, copyFile, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("playwright");

const origem = "http://127.0.0.1:4174";
const api = "http://127.0.0.1:3100";
const processos = [];
let browser;
let temporario;
let total = 0;

async function pronto(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processos.some((processo) => processo.exitCode !== null)) throw new Error("Servidor encerrou antes do teste.");
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-marco2-"));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const seed = JSON.parse(await readFile("db.seed.json", "utf8"));
  processos.push(spawn(process.execPath, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", "3100"], { windowsHide: true, stdio: "pipe" }));
  processos.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4174", "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: api } }));
  for (const processo of processos) {
    processo.stdout.on("data", () => {});
    processo.stderr.on("data", (data) => process.stderr.write(data));
  }
  await Promise.all([pronto(origem), pronto(`${api}/tarefas`)]);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  const abrir = async (rota) => { await page.goto(`${origem}${rota}`); await page.getByRole("status").waitFor({ state: "hidden" }); };
  const texto = async () => page.locator("main").innerText();

  await conferir("lista original mantém as cinco tarefas sem duplicações", async () => {
    await abrir("/");
    assert.equal(await page.locator("article").count(), seed.tarefas.length);
    for (const tarefa of seed.tarefas) assert.equal(await page.getByRole("link", { name: tarefa.titulo, exact: true }).count(), 1);
  });
  await conferir("detalhe direto apresenta os nove campos e permite recarregar", async () => {
    await abrir("/tarefas/2");
    let conteudo = await texto();
    for (const valor of ["Subir o json-server", "API local a partir do db.json", "Em andamento", "alta", "Bruno", "06/10/2026", "Identificador", "Projeto 1"]) assert.ok(conteudo.includes(valor), valor);
    assert.equal(await page.locator(".detalhes-registro dd").first().innerText(), "2");
    await page.reload();
    await page.getByRole("link", { name: "Subir o json-server", exact: true }).waitFor();
  });
  await conferir("layout persiste e os links navegam sem recarregar o documento", async () => {
    await page.evaluate(() => { window.marcadorNavegacao = "preservado"; });
    await page.getByRole("navigation").getByRole("link", { name: "Projetos", exact: true }).click();
    await page.getByRole("link", { name: "Gerenciador de Tarefas", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.marcadorNavegacao), "preservado");
    assert.equal(await page.getByRole("navigation").count(), 1);
    assert.equal(await page.getByRole("navigation").getByRole("link", { name: "Projetos" }).getAttribute("aria-current"), "page");
  });
  await conferir("lista apresenta os dois projetos com links corretos", async () => {
    assert.equal(await page.locator("article").count(), seed.projetos.length);
    for (const projeto of seed.projetos) assert.equal(await page.getByRole("link", { name: projeto.nome, exact: true }).getAttribute("href"), `/projetos/${projeto.id}`);
  });
  await conferir("projetos consultam embed e exibem somente suas tarefas", async () => {
    for (const projeto of seed.projetos) {
      const resposta = page.waitForResponse(`${api}/projetos/${projeto.id}?_embed=tarefas`);
      await abrir(`/projetos/${projeto.id}`);
      assert.equal((await resposta).status(), 200);
      const tarefas = seed.tarefas.filter((tarefa) => tarefa.projetoId === projeto.id);
      assert.equal(await page.locator("article").count(), tarefas.length);
      const conteudo = await texto();
      for (const tarefa of tarefas) assert.ok(conteudo.includes(tarefa.titulo));
      for (const tarefa of seed.tarefas.filter((tarefa) => tarefa.projetoId !== projeto.id)) assert.ok(!conteudo.includes(tarefa.titulo));
      assert.ok(conteudo.includes(projeto.descricao));
      assert.ok(conteudo.includes(projeto.disciplina));
    }
  });
  await conferir("troca de parâmetro não mantém dados da tarefa anterior", async () => {
    await abrir("/tarefas/1");
    await page.route(`${api}/tarefas/2`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 400)); await route.continue(); });
    await page.evaluate(() => { history.pushState({}, "", "/tarefas/2"); dispatchEvent(new PopStateEvent("popstate")); });
    await page.getByRole("status").waitFor();
    assert.ok(!(await texto()).includes("Criar o repositório"));
    await page.getByRole("link", { name: "Subir o json-server", exact: true }).waitFor();
    await page.unrouteAll();
  });
  await conferir("resposta atrasada não substitui o projeto atual", async () => {
    await page.route(`${api}/projetos/1*`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 400)); await route.continue(); });
    await page.goto(`${origem}/projetos/1`);
    await page.getByRole("status").waitFor();
    await page.evaluate(() => { history.pushState({}, "", "/projetos/2"); dispatchEvent(new PopStateEvent("popstate")); });
    await page.getByRole("heading", { name: "Modelagem da Biblioteca", exact: true }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.locator("article").count(), 1);
    assert.ok(!(await texto()).includes("Criar o repositório"));
    await page.unrouteAll();
  });
  await conferir("IDs inexistentes encerram carregamento com mensagem", async () => {
    for (const [rota, mensagem] of [["/tarefas/999", "Tarefa não encontrada."], ["/projetos/999", "Projeto não encontrado."]]) {
      await abrir(rota);
      assert.equal(await page.getByRole("alert").innerText(), mensagem);
      assert.equal(await page.getByRole("status").count(), 0);
    }
  });
  await conferir("listas vazias e projeto sem tarefas têm mensagens", async () => {
    await page.route(`${api}/projetos`, (route) => route.fulfill({ json: [] }));
    await abrir("/projetos");
    assert.ok((await texto()).includes("Nenhum projeto cadastrado."));
    await page.unrouteAll();
    await page.route(`${api}/projetos/1?_embed=tarefas`, (route) => route.fulfill({ json: { ...seed.projetos[0], tarefas: [] } }));
    await abrir("/projetos/1");
    assert.ok((await texto()).includes("Nenhuma tarefa neste projeto."));
    await page.unrouteAll();
  });
  await conferir("falha de rede apresenta erro nas três telas novas", async () => {
    await page.route(`${api}/**`, (route) => route.abort("connectionrefused"));
    for (const rota of ["/tarefas/2", "/projetos", "/projetos/1"]) {
      await abrir(rota);
      assert.ok((await page.getByRole("alert").innerText()).includes("Confira se a API está em execução."));
      assert.equal(await page.getByRole("status").count(), 0);
    }
    await page.unrouteAll();
  });
  await conferir("fallback mantém navegação e retorno à lista", async () => {
    await abrir("/rota-inexistente");
    assert.ok((await texto()).includes("Página não encontrada"));
    await page.getByRole("link", { name: "Voltar para tarefas" }).click();
    await page.getByRole("link", { name: seed.tarefas[0].titulo, exact: true }).waitFor();
  });
  await conferir("telas cabem em 375 px e links recebem foco por teclado", async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const rota of ["/", "/tarefas/2", "/projetos", "/projetos/1"]) {
      await abrir(rota);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), rota);
    }
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.tagName), "A");
  });
  assert.deepEqual(erros, []);
  console.log(`${total} cenários aprovados; nenhum erro JavaScript não tratado.`);
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
