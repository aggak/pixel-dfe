// Integração da issue #30 com aplicação real e banco temporário.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdir, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { chromium } = require("playwright");

const raiz = join(__dirname, "..");
const processos = [];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let temporario;
let total = 0;

async function ate(descricao, verificar) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (await verificar()) return;
    await dormir(100);
  }
  throw new Error(`Tempo esgotado: ${descricao}`);
}

async function conferir(nome, executar) {
  await executar();
  total++;
  console.log(`OK: ${nome}`);
}

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedOriginal);
  temporario = await mkdtemp(join(tmpdir(), "pixel-editar-tarefa-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const portaApi = await portaLivre();
  const portaWeb = await portaLivre();
  const api = `http://127.0.0.1:${portaApi}`;
  const origem = `http://127.0.0.1:${portaWeb}`;
  function iniciar(arquivo, argumentos, env = process.env) {
    const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], {
      cwd: raiz, env, windowsHide: true, stdio: "pipe",
    });
    processo.stdout.on("data", () => {});
    processo.stderr.on("data", (dado) => process.stderr.write(dado));
    processos.push(processo);
  }
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  for (const url of [`${api}/tarefas`, origem]) {
    await ate(`servidor ${url}`, async () => {
      if (processos.some((p) => p.exitCode !== null)) throw new Error("Servidor encerrou antes dos testes.");
      try { return (await fetch(url)).ok; } catch { return false; }
    });
  }
  browser = await chromium.launch({ channel: process.env.TEST_BROWSER || "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  const gravacoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (req) => {
    if (req.url().startsWith(api) && ["POST", "PATCH", "PUT"].includes(req.method())) {
      gravacoes.push({ metodo: req.method(), caminho: new URL(req.url()).pathname, dados: req.postDataJSON() });
    }
  });
  const campo = (nome) => page.getByLabel(nome, { exact: true });
  const salvar = () => page.getByRole("button", { name: "Salvar alterações", exact: true });
  const caminho = () => new URL(page.url()).pathname;
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));
  async function esperarFormulario(id) {
    const dados = (await lerBanco()).tarefas.find((t) => t.id === id);
    await page.locator("form").waitFor();
    await ate(`valores da tarefa ${id}`, async () => (await campo("Título").inputValue()) === dados.titulo);
    await ate("projetos carregados", async () => (await campo("Projeto").evaluate((el) => el.options.length)) >= seed.projetos.length + 1);
    return dados;
  }
  async function abrir(id = "1") {
    await page.goto(`${origem}/tarefas/${id}/editar`);
    return esperarFormulario(id);
  }
  async function trocarRota(rota) {
    await page.evaluate((url) => {
      history.pushState({}, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    }, rota);
  }

  await conferir("link de edição, acesso direto e recarga com todos os campos preenchidos", async () => {
    await page.goto(`${origem}/tarefas/1`);
    await page.getByRole("link", { name: "Editar tarefa", exact: true }).click();
    assert.equal(caminho(), "/tarefas/1/editar");
    const tarefa = await esperarFormulario("1");
    const campos = { Projeto: "projetoId", Título: "titulo", Descrição: "descricao", Status: "status", Prioridade: "prioridade", Responsável: "responsavel", Prazo: "prazo" };
    for (const [rotulo, atributo] of Object.entries(campos)) assert.equal(await campo(rotulo).inputValue(), tarefa[atributo]);
    await page.reload();
    await esperarFormulario("1");
    assert.equal(await campo("Prazo").inputValue(), tarefa.prazo);
  });

  await conferir("PATCH real mantém ID e quantidade, persiste os sete campos e retorna ao detalhe", async () => {
    await abrir();
    const dados = { projetoId: "2", titulo: "Tarefa editada na integração", descricao: "Descrição atualizada\ncom segunda linha", status: "em-revisao", prioridade: "baixa", responsavel: "Euclides", prazo: "2026-10-20" };
    for (const [rotulo, valor] of [["Projeto", dados.projetoId], ["Status", dados.status], ["Prioridade", dados.prioridade]]) await campo(rotulo).selectOption(valor);
    for (const [rotulo, valor] of [["Título", dados.titulo], ["Descrição", dados.descricao], ["Responsável", dados.responsavel], ["Prazo", dados.prazo]]) await campo(rotulo).fill(valor);
    gravacoes.length = 0;
    await salvar().click();
    await ate("retorno ao detalhe", async () => caminho() === "/tarefas/1");
    await page.getByRole("link", { name: dados.titulo, exact: true }).waitFor();
    assert.deepEqual(gravacoes, [{ metodo: "PATCH", caminho: "/tarefas/1", dados }]);
    const db = await lerBanco();
    assert.equal(db.tarefas.length, seed.tarefas.length);
    assert.deepEqual(db.tarefas.find((t) => t.id === "1"), { id: "1", ...dados });
    assert.deepEqual(db.tarefas.filter((t) => t.id !== "1"), seed.tarefas.filter((t) => t.id !== "1"));
    await page.reload();
    await page.getByRole("link", { name: dados.titulo, exact: true }).waitFor();
    await abrir();
    assert.equal(await campo("Projeto").inputValue(), "2");
    assert.equal(await campo("Descrição").inputValue(), dados.descricao);
  });

  await conferir("cancelar e voltar ao detalhe não gravam alterações", async () => {
    const antes = await lerBanco();
    gravacoes.length = 0;
    for (const acao of ["Cancelar", "Voltar para a tarefa"]) {
      await abrir();
      await campo("Título").fill("Alteração cancelada");
      await page.getByRole(acao === "Cancelar" ? "button" : "link", { name: acao, exact: true }).click();
      await ate(`detalhe após ${acao}`, async () => caminho() === "/tarefas/1");
    }
    assert.equal(gravacoes.length, 0);
    assert.deepEqual(await lerBanco(), antes);
  });

  await conferir("ID inexistente encerra carregamento e não abre formulário", async () => {
    await page.goto(`${origem}/tarefas/999/editar`);
    await page.getByRole("alert").filter({ hasText: "Tarefa não encontrada." }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.getByRole("status").count(), 0);
  });

  await conferir("falha de leitura informa erro e encerra carregamento", async () => {
    await page.route(`${api}/tarefas/1`, (route) => route.abort("connectionrefused"));
    await page.goto(`${origem}/tarefas/1/editar`);
    await page.getByRole("alert").filter({ hasText: "Não foi possível carregar a tarefa" }).waitFor();
    assert.equal(await page.locator("form").count(), 0);
    assert.equal(await page.getByRole("status").count(), 0);
    await page.unrouteAll();
  });

  await conferir("trocar ID reinicia campos e ignora leitura atrasada", async () => {
    await abrir("1");
    await campo("Título").fill("Rascunho da tarefa anterior");
    await trocarRota("/tarefas/2/editar");
    await esperarFormulario("2");
    assert.equal(await campo("Título").inputValue(), seed.tarefas[1].titulo);
    let iniciou = false;
    await page.route(`${api}/tarefas/1`, async (route) => {
      iniciou = true;
      await dormir(800);
      try { await route.fulfill({ json: seed.tarefas[0] }); } catch {}
    });
    await trocarRota("/tarefas/1/editar");
    await ate("leitura atrasada iniciada", async () => iniciou);
    assert.equal(await page.locator("form").count(), 0);
    await trocarRota("/tarefas/2/editar");
    await esperarFormulario("2");
    await dormir(1000);
    assert.equal(await campo("Título").inputValue(), seed.tarefas[1].titulo);
    await page.unrouteAll();
  });

  await conferir("PATCH com erro preserva os dados e permite tentar novamente", async () => {
    await abrir("2");
    await campo("Título").fill("Título preservado após falha");
    await page.route(`${api}/tarefas/2`, (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 500, json: {} }) : route.continue());
    await salvar().click();
    await page.getByRole("alert").filter({ hasText: "Não foi possível salvar a tarefa" }).waitFor();
    assert.equal(caminho(), "/tarefas/2/editar");
    assert.equal(await campo("Título").inputValue(), "Título preservado após falha");
    await ate("envio liberado após erro", () => salvar().isEnabled());
    await page.unrouteAll();
    await salvar().click();
    await ate("detalhe após nova tentativa", async () => caminho() === "/tarefas/2");
    await page.getByRole("link", { name: "Título preservado após falha", exact: true }).waitFor();
  });

  await conferir("envio pendente bloqueia duplicação e só navega após a resposta", async () => {
    await abrir();
    await page.route(`${api}/tarefas/1`, async (route) => {
      if (route.request().method() === "PATCH") await dormir(800);
      try { await route.continue(); } catch {}
    });
    gravacoes.length = 0;
    await salvar().click();
    await ate("botão bloqueado", () => page.locator('form button[type="submit"]').isDisabled());
    await page.evaluate(() => document.querySelector("form").requestSubmit());
    assert.equal(caminho(), "/tarefas/1/editar");
    await ate("detalhe após gravação", async () => caminho() === "/tarefas/1");
    assert.equal(gravacoes.length, 1);
    await page.unrouteAll();
  });

  await conferir("sair durante gravação não permite redirecionamento atrasado", async () => {
    await abrir();
    const tarefa = (await lerBanco()).tarefas.find((t) => t.id === "1");
    await page.route(`${api}/tarefas/1`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await dormir(800);
      try { await route.fulfill({ json: tarefa }); } catch {}
    });
    await salvar().click();
    await ate("envio em curso", () => page.locator('form button[type="submit"]').isDisabled());
    await page.getByRole("navigation").getByRole("link", { name: "Projetos", exact: true }).click();
    await page.getByRole("heading", { name: "Projetos", exact: true }).waitFor();
    await dormir(1000);
    assert.equal(caminho(), "/projetos");
    await page.unrouteAll();
  });

  await conferir("trocar tarefa durante gravação não altera o novo contexto", async () => {
    await abrir();
    const tarefa = (await lerBanco()).tarefas.find((t) => t.id === "1");
    await page.route(`${api}/tarefas/1`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await dormir(800);
      try { await route.fulfill({ json: tarefa }); } catch {}
    });
    await salvar().click();
    await ate("envio em curso", () => page.locator('form button[type="submit"]').isDisabled());
    await trocarRota("/tarefas/2/editar");
    const atual = await esperarFormulario("2");
    await dormir(1000);
    assert.equal(caminho(), "/tarefas/2/editar");
    assert.equal(await campo("Título").inputValue(), atual.titulo);
    assert.equal(await salvar().isEnabled(), true);
    await page.unrouteAll();
  });

  await conferir("edição em 320px, foco visível e envio por teclado", async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await abrir();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await campo("Título").focus();
    await page.keyboard.press("Tab");
    assert.equal(await campo("Descrição").evaluate((el) => el === document.activeElement), true);
    assert.notEqual(await campo("Descrição").evaluate((el) => getComputedStyle(el).outlineStyle), "none");
    if (process.env.EDITAR_TAREFA_EVIDENCIAS) {
      await mkdir(process.env.EDITAR_TAREFA_EVIDENCIAS, { recursive: true });
      await page.screenshot({ path: join(process.env.EDITAR_TAREFA_EVIDENCIAS, "editar-tarefa-320.png"), fullPage: true });
    }
    await campo("Título").focus();
    await page.keyboard.press("Enter");
    await ate("envio pelo teclado", async () => caminho() === "/tarefas/1");
  });

  await conferir("sem erros JavaScript e bancos do repositório preservados", async () => {
    assert.deepEqual(errosPagina, []);
    assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
    assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  });
  console.log(`${total} cenários aprovados; bancos originais preservados.`);
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  for (const processo of processos) {
    if (processo.exitCode === null) {
      const fim = new Promise((resolve) => processo.once("exit", resolve));
      processo.kill();
      await fim;
    }
  }
  if (temporario) await rm(temporario, { recursive: true, force: true });
});
