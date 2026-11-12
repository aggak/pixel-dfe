const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador, criarUi, comTextos } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const processos = [];
let browser;
let temporario;

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function esperar(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processos.some((processo) => processo.exitCode !== null && !processo.parado)) throw new Error("Servidor encerrou antes do teste.");
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(arquivo, argumentos, env = process.env) {
  const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], {
    cwd: raiz, env, windowsHide: true, stdio: "pipe",
  });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (dado) => process.stderr.write(dado));
  processos.push(processo);
  return processo;
}

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  temporario = await mkdtemp(join(tmpdir(), "pixel-falha-gravar-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const seed = JSON.parse(seedOriginal);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;

  // A API fica indisponível de verdade: o processo do json-server é encerrado e depois reiniciado na mesma porta.
  let servidorApi;
  const ligarApi = async () => {
    servidorApi = iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
    await esperar(`${api}/tarefas`);
  };
  const desligarApi = async () => {
    servidorApi.parado = true;
    const encerrado = new Promise((resolve) => servidorApi.once("exit", resolve));
    servidorApi.kill();
    await encerrado;
    await assert.rejects(fetch(`${api}/tarefas`));
  };
  const lerBanco = async () => JSON.parse(await readFile(banco, "utf8"));

  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([ligarApi(), esperar(web)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const ficha = () => page.locator(".e-form-overlay").getByRole("dialog");
  const ui = criarUi(page, () => ficha().locator("form"));
  const focoDentro = (locator) => locator.evaluate((el) => el.contains(document.activeElement) && document.activeElement !== el);

  // Cadastro de tarefa: todos os sete campos sobrevivem à falha e o mesmo envio grava quando a API volta.
  const novaTarefa = comTextos({ projetoId: "2", titulo: "Entregar o protótipo", descricao: "Com as telas de cadastro", status: "em-revisao", prioridade: "alta", responsavel: "Carla", prazo: "2026-12-10" }, seed.projetos);
  await page.goto(`${web}/tarefas/nova`);
  await ui.campo("Título").waitFor();
  while (!(await ui.projetosCarregados(2))) await page.waitForTimeout(50);
  await ui.preencherTarefa(novaTarefa);
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar tarefa" }).click();
  await ficha().getByRole("alert").filter({ hasText: "Não foi possível salvar a tarefa. Seus dados foram mantidos; tente de novo." }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/tarefas/nova");
  for (const [rotulo, chave] of [["Título", "titulo"], ["Descrição", "descricao"], ["Responsável", "responsavel"], ["Prazo", "prazo"], ["Projeto", "projetoId"], ["Status", "status"], ["Prioridade", "prioridade"]]) {
    assert.equal(await ui.valor(rotulo), novaTarefa[chave], rotulo);
  }
  assert.equal(await focoDentro(ficha()), true, "foco saiu da ficha após a falha");
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar tarefa" }).click();
  await page.waitForURL(`${web}/`);
  await page.getByRole("link", { name: novaTarefa.titulo, exact: true }).waitFor();
  assert.equal((await lerBanco()).tarefas.filter((tarefa) => tarefa.titulo === novaTarefa.titulo).length, 1);
  console.log("OK: cadastrar tarefa com a API parada avisa, mantém os sete campos e grava ao tentar de novo");

  // Edição de tarefa.
  await page.goto(`${web}/tarefas/1/editar`);
  await ui.campo("Título").waitFor();
  await ui.campo("Título").fill("Criar o repositório no GitHub");
  await ui.campo("Responsável").fill("Davi");
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await ficha().getByRole("alert").filter({ hasText: "Não foi possível salvar a tarefa. Seus dados foram mantidos; tente de novo." }).waitFor();
  assert.equal(await ui.valor("Título"), "Criar o repositório no GitHub");
  assert.equal(await ui.valor("Responsável"), "Davi");
  assert.equal(await focoDentro(ficha()), true, "foco saiu da ficha após a falha");
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(`${web}/tarefas/1`);
  await ficha().getByRole("heading", { name: "Criar o repositório no GitHub" }).waitFor();
  console.log("OK: editar tarefa com a API parada avisa, mantém o texto e grava ao tentar de novo");

  // Cadastro e edição de projeto.
  const ficharProjeto = criarUi(page, () => ficha().locator("form"));
  await page.goto(`${web}/projetos/novo`);
  await ficharProjeto.campo("Nome").waitFor();
  await ficharProjeto.campo("Nome").fill("Portfólio da turma");
  await ficharProjeto.campo("Descrição").fill("Página com os trabalhos");
  await ficharProjeto.campo("Disciplina").fill("DFE");
  await ficharProjeto.campo("Criado em").fill("2026-10-20");
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar projeto" }).click();
  await ficha().getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo." }).waitFor();
  for (const [rotulo, esperado] of [["Nome", "Portfólio da turma"], ["Descrição", "Página com os trabalhos"], ["Disciplina", "DFE"], ["Criado em", "2026-10-20"]]) {
    assert.equal(await ficharProjeto.campo(rotulo).inputValue(), esperado, rotulo);
  }
  assert.equal(await focoDentro(ficha()), true, "foco saiu da ficha após a falha");
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar projeto" }).click();
  await page.waitForURL(`${web}/projetos`);
  assert.equal((await lerBanco()).projetos.filter((projeto) => projeto.nome === "Portfólio da turma").length, 1);
  console.log("OK: cadastrar projeto com a API parada avisa, mantém os campos e grava ao tentar de novo");

  await page.goto(`${web}/projetos/2/editar`);
  await ficharProjeto.campo("Nome").waitFor();
  await ficharProjeto.campo("Nome").fill("Modelagem da Biblioteca Central");
  await desligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await ficha().getByRole("alert").filter({ hasText: "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo." }).waitFor();
  assert.equal(await ficharProjeto.campo("Nome").inputValue(), "Modelagem da Biblioteca Central");
  await ligarApi();
  await ficha().getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL(`${web}/projetos/2`);
  await page.getByRole("heading", { level: 1, name: "Modelagem da Biblioteca Central" }).waitFor();
  console.log("OK: editar projeto com a API parada avisa, mantém o texto e grava ao tentar de novo");

  // Exclusão: o diálogo continua aberto com o aviso e o foco, e a mesma confirmação funciona quando a API volta.
  for (const [caminho, id, titulo] of [["/", "2", "Subir o json-server"], ["/quadro", "3", "Montar o quadro no GitHub Projects"], ["/projetos/1", "4", "Listar as tarefas na tela"]]) {
    await page.goto(`${web}${caminho}`);
    await page.locator(`[data-task-id="${id}"]`).waitFor();
    await page.getByRole("button", { name: `Ações de ${titulo}` }).click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    const dialogo = page.getByRole("dialog", { name: `Excluir ${titulo}` });
    await desligarApi();
    await dialogo.getByRole("button", { name: "Excluir tarefa", exact: true }).click();
    await dialogo.getByRole("alert").filter({ hasText: "Não foi possível excluir a tarefa. Tente de novo." }).waitFor();
    assert.equal(await page.locator(`[data-task-id="${id}"]`).count(), 1, `${caminho}: cartão sumiu sem excluir`);
    assert.equal(await dialogo.getByRole("button", { name: "Excluir tarefa", exact: true }).evaluate((el) => el === document.activeElement), true, `${caminho}: foco saiu do botão de confirmar`);
    await ligarApi();
    await page.keyboard.press("Enter");
    await dialogo.waitFor({ state: "detached" });
    await page.locator(`[data-task-id="${id}"]`).waitFor({ state: "detached" });
    assert.equal((await lerBanco()).tarefas.some((tarefa) => tarefa.id === id), false);
    console.log(`OK: ${caminho} excluir com a API parada avisa, mantém o foco e exclui ao tentar de novo`);
  }

  // Mudança de status também grava: com a API parada, avisa e o foco volta ao seletor.
  await page.goto(`${web}/`);
  const seletor = page.getByRole("button", { name: /^Mudar status de Desenhar o diagrama ER/ });
  await seletor.waitFor();
  await desligarApi();
  await seletor.click();
  await page.getByRole("menuitemradio", { name: "Concluída" }).click();
  await page.locator('[data-task-id="5"]').getByRole("alert").filter({ hasText: "Não foi possível mudar o status. Tente de novo." }).waitFor();
  // O menu termina de fechar depois que o aviso aparece; o foco chega ao seletor logo em seguida.
  await page.waitForFunction(() => document.activeElement?.matches('[data-task-id="5"] [data-status-trigger]'));
  await ligarApi();
  console.log("OK: mudar status com a API parada avisa e devolve o foco ao seletor");

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  console.log("OK: sem erros JavaScript e bancos locais preservados");
}

executar()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close().catch(() => {});
    for (const processo of processos) {
      // Um processo encerrado por kill() fica com exitCode null e signalCode preenchido: já saiu, não espera de novo.
      if (processo.exitCode === null && processo.signalCode === null) {
        const encerrado = new Promise((resolve) => processo.once("exit", resolve));
        processo.kill();
        await encerrado;
      }
    }
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
