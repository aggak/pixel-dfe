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
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

async function executar() {
  const temporario = await mkdtemp(join(tmpdir(), "pixel-filtros-"));
  const processos = [];
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
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
    const errosJs = [];
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    await page.goto(web);
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const busca = page.getByRole("searchbox", { name: "Buscar por título" });
    const seletor = (nome) => page.getByRole("button", { name: new RegExp(nome) });
    const selecionar = async (nome, opcao) => {
      await seletor(nome).click();
      const item = page.getByRole("option", { name: opcao, exact: true });
      await item.click();
      await item.waitFor({ state: "detached" });
    };
    const titulos = () => lista.locator(".e-task-title").allInnerTexts();
    await lista.getByRole("article").first().waitFor();

    // Mesmo conjunto que a função pura produziria com os dados do banco.
    await busca.fill("a");
    await selecionar("Status", "A fazer");
    const esperado = dados.tarefas.filter((t) => t.titulo.toLocaleLowerCase("pt-BR").includes("a") && t.status === "a-fazer").map((t) => t.titulo);
    assert.deepEqual(await titulos(), esperado);
    console.log("OK: lista exibe o conjunto derivado de busca e status");

    // Troca de rota pelo menu desmonta a lista; o estado mora acima das rotas.
    const menu = page.getByRole("navigation", { name: "Navegação principal" });
    await menu.getByRole("link", { name: "Projetos" }).click();
    await page.getByRole("heading", { name: "Projetos" }).waitFor();
    assert.equal(await lista.count(), 0);
    await menu.getByRole("link", { name: "Tarefas" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await busca.inputValue(), "a");
    assert.match(await seletor("Status").innerText(), /A fazer/);
    assert.deepEqual(await titulos(), esperado);
    console.log("OK: busca e status continuam aplicados após trocar de rota");

    await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Gerenciador de Tarefas" }).click();
    await page.getByRole("region", { name: "Tarefas do projeto" }).getByRole("article").first().waitFor();
    await page.getByRole("navigation", { name: "Projetos" }).getByRole("link", { name: "Todas" }).click();
    await selecionar("Prioridade", "Baixa");
    assert.deepEqual(await titulos(), dados.tarefas.filter((t) => t.titulo.toLocaleLowerCase("pt-BR").includes("a") && t.status === "a-fazer" && t.prioridade === "baixa").map((t) => t.titulo));
    console.log("OK: filtros combinam entre si depois de visitar um projeto");

    // A ficha de detalhe abre sobre a lista sem perder o que foi filtrado.
    const primeiro = (await titulos())[0];
    await lista.getByRole("link", { name: primeiro }).click();
    const ficha = page.getByRole("dialog", { name: "Detalhes da tarefa" });
    await ficha.waitFor();
    await ficha.getByRole("button", { name: /^Fechar/ }).click();
    await ficha.waitFor({ state: "detached" });
    assert.equal(await busca.inputValue(), "a");
    assert.deepEqual(await titulos(), [primeiro]);
    console.log("OK: abrir e fechar a ficha mantém busca e filtros");

    await busca.fill("sem correspondência");
    await page.getByText("Nenhuma tarefa encontrada").waitFor();
    await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);
    assert.equal(await busca.inputValue(), "");
    assert.match(await seletor("Status").innerText(), /Todos os status/);
    assert.match(await seletor("Prioridade").innerText(), /Todas as prioridades/);
    console.log("OK: limpar volta busca, status e prioridade aos valores iniciais");

    // O estado fica na memória do JavaScript: recarregar a página começa do zero.
    await busca.fill("json");
    await page.reload();
    await lista.getByRole("article").first().waitFor();
    assert.equal(await busca.inputValue(), "");
    assert.equal(await lista.getByRole("article").count(), dados.tarefas.length);
    console.log("OK: recarregar a página reinicia os filtros");

    assert.deepEqual(errosJs, []);
    const atuais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
    assert.deepEqual(atuais, originais);
    console.log("6 cenários aprovados; nenhum erro JavaScript não tratado.");
  } finally {
    if (browser) await browser.close();
    for (const processo of processos) processo.kill();
    await rm(temporario, { recursive: true, force: true });
  }
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; });
