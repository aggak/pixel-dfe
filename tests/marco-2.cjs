const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtemp, copyFile, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { createServer } = require("node:net");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

let origem = "";
let api = "";
const processos = [];
let browser;
let temporario;
let total = 0;

// O sistema escolhe portas livres, como nas demais suítes, sem tomar as de outros processos.
async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve, reject) => { servidor.once("error", reject); servidor.listen(0, "127.0.0.1", resolve); });
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}

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
  const portaApi = await portaLivre();
  const portaWeb = await portaLivre();
  api = `http://127.0.0.1:${portaApi}`;
  origem = `http://127.0.0.1:${portaWeb}`;
  processos.push(spawn(process.execPath, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)], { windowsHide: true, stdio: "pipe" }));
  processos.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { windowsHide: true, stdio: "pipe", env: { ...process.env, VITE_API_URL: api } }));
  for (const processo of processos) {
    processo.stdout.on("data", () => {});
    processo.stderr.on("data", (data) => process.stderr.write(data));
  }
  await Promise.all([pronto(origem), pronto(`${api}/tarefas`)]);
  browser = await lancarNavegador();
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const erros = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  // Espera a tela renderizar e todos os indicadores de carregamento (fundo e ficha) saírem.
  const abrir = async (rota) => {
    await page.goto(`${origem}${rota}`);
    await page.waitForFunction(() => document.querySelector("main") && !document.querySelector('[role="status"]'));
  };
  const texto = async () => page.locator("main").innerText();
  const ficha = () => page.getByRole("dialog");
  const textoFicha = async () => ficha().innerText();

  await conferir("lista original mantém as cinco tarefas sem duplicações", async () => {
    await abrir("/");
    assert.equal(await page.locator("article").count(), seed.tarefas.length);
    for (const tarefa of seed.tarefas) assert.equal(await page.getByRole("link", { name: tarefa.titulo, exact: true }).count(), 1);
  });
  await conferir("detalhe direto apresenta os oito campos e permite recarregar", async () => {
    await abrir("/tarefas/2");
    await page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).waitFor();
    const conteudo = await textoFicha();
    // A data agora é apresentada por extenso; o valor ISO fica no atributo do elemento <time>.
    for (const valor of ["Subir o json-server", "API local a partir do db.json", "Em andamento", "Alta", "Bruno", "6 de outubro de 2026", "Identificador", "Gerenciador de Tarefas"]) assert.ok(conteudo.includes(valor), valor);
    assert.equal(await ficha().locator("time").getAttribute("datetime"), "2026-10-06");
    assert.equal(await ficha().locator(".e-read-identifiers dd").first().innerText(), "2");
    assert.equal(await ficha().locator(".e-read-identifiers dd").nth(1).innerText(), "1");
    await page.reload();
    await page.getByRole("heading", { name: "Subir o json-server", exact: true }).waitFor();
  });
  await conferir("layout persiste e os links navegam sem recarregar o documento", async () => {
    await page.evaluate(() => { window.marcadorNavegacao = "preservado"; });
    // A ficha bloqueia o fundo: fecha-se o detalhe (navegação interna) antes de usar o menu principal.
    await page.keyboard.press("Escape");
    await ficha().waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => window.marcadorNavegacao), "preservado");
    const principal = page.getByRole("navigation", { name: "Navegação principal", exact: true });
    await principal.getByRole("link", { name: "Projetos", exact: true }).click();
    await page.getByRole("heading", { name: "Projetos", exact: true }).waitFor();
    await page.getByRole("region", { name: "Lista de projetos" }).waitFor();
    assert.equal(await page.evaluate(() => window.marcadorNavegacao), "preservado");
    assert.equal(await principal.count(), 1);
    assert.equal(await principal.getByRole("link", { name: "Projetos" }).getAttribute("aria-current"), "page");
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
      // Descrição, disciplina e data de criação ficam em "Detalhes do projeto", recolhido por padrão.
      await page.getByRole("button", { name: "Detalhes do projeto", exact: true }).click();
      await page.locator("#project-details").waitFor();
      const conteudo = await texto();
      for (const tarefa of tarefas) assert.ok(conteudo.includes(tarefa.titulo));
      for (const tarefa of seed.tarefas.filter((tarefa) => tarefa.projetoId !== projeto.id)) assert.ok(!conteudo.includes(tarefa.titulo));
      assert.ok(conteudo.includes(projeto.descricao));
      assert.ok(conteudo.includes(projeto.disciplina));
      assert.equal(await page.locator("#project-details time").getAttribute("datetime"), projeto.criadoEm);
    }
  });
  await conferir("troca de parâmetro não mantém dados da tarefa anterior", async () => {
    await abrir("/tarefas/1");
    await page.route(`${api}/tarefas/2`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 400)); await route.continue(); });
    await page.evaluate(() => { history.pushState({}, "", "/tarefas/2"); dispatchEvent(new PopStateEvent("popstate")); });
    await ficha().getByRole("status").waitFor();
    assert.ok(!(await textoFicha()).includes("Criar o repositório"));
    await page.getByRole("heading", { name: "Subir o json-server", exact: true }).waitFor();
    await page.unrouteAll();
  });
  await conferir("resposta atrasada não substitui o projeto atual", async () => {
    await page.route(`${api}/projetos/1*`, async (route) => { await new Promise((resolve) => setTimeout(resolve, 400)); await route.continue(); });
    await page.goto(`${origem}/projetos/1`);
    await page.getByRole("status").filter({ hasText: /^Carregando projeto…$/ }).waitFor();
    await page.evaluate(() => { history.pushState({}, "", "/projetos/2"); dispatchEvent(new PopStateEvent("popstate")); });
    await page.getByRole("heading", { name: "Modelagem da Biblioteca", exact: true }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.locator("article").count(), 1);
    assert.ok(!(await texto()).includes("Criar o repositório"));
    await page.unrouteAll();
  });
  await conferir("IDs inexistentes encerram carregamento com mensagem", async () => {
    // Tarefa abre na ficha com a mensagem exata; o projeto mostra título e explicação na própria tela.
    await abrir("/tarefas/999");
    assert.equal(await page.getByRole("alert").innerText(), "Tarefa não encontrada.");
    assert.equal(await page.getByRole("status").count(), 0);
    await abrir("/projetos/999");
    const alerta = await page.getByRole("alert").innerText();
    assert.ok(alerta.includes("Projeto não encontrado"), alerta);
    assert.ok(alerta.includes("Este projeto não está disponível."), alerta);
    assert.equal(await page.getByRole("status").count(), 0);
  });
  await conferir("listas vazias e projeto sem tarefas têm mensagens", async () => {
    await page.route(`${api}/projetos`, (route) => route.fulfill({ json: [] }));
    await abrir("/projetos");
    const vazio = await texto();
    assert.ok(vazio.includes("Nenhum projeto por aqui") && vazio.includes("Crie um projeto para reunir suas tarefas."), vazio);
    await page.getByRole("button", { name: "Criar projeto", exact: true }).waitFor();
    await page.unrouteAll();
    await page.route(`${api}/projetos/1?_embed=tarefas`, (route) => route.fulfill({ json: { ...seed.projetos[0], tarefas: [] } }));
    await abrir("/projetos/1");
    const semTarefas = await texto();
    assert.ok(semTarefas.includes("Crie a primeira tarefa de Gerenciador de Tarefas."), semTarefas);
    await page.getByRole("button", { name: "Criar tarefa", exact: true }).waitFor();
    assert.equal(await page.locator("article").count(), 0);
    await page.unrouteAll();
  });
  await conferir("falha de rede apresenta erro nas três telas novas", async () => {
    await page.route(`${api}/**`, (route) => route.abort("connectionrefused"));
    for (const rota of ["/tarefas/2", "/projetos", "/projetos/1"]) {
      await abrir(rota);
      const alvo = rota.startsWith("/tarefas/") ? ficha() : page;
      assert.equal(await alvo.getByRole("alert").count(), 1);
      assert.ok((await alvo.getByRole("alert").innerText()).includes("Confira se a API está em execução."));
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
