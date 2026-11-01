const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

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
    if (processos.some((processo) => processo.exitCode !== null)) throw new Error("Servidor encerrou antes do teste.");
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
}


async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedOriginal);
  temporario = await mkdtemp(join(tmpdir(), "pixel-vazio-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([esperar(`${api}/tarefas`), esperar(web)]);

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const vazio = (titulo) => page.getByRole("main").locator(".e-empty").filter({ has: page.getByRole("heading", { name: titulo }) });
  const busca = () => page.getByPlaceholder("Buscar tarefas");

  await page.route(`${api}/tarefas`, (rota) => rota.fulfill({ json: [] }));
  for (const caminho of ["/", "/quadro"]) {
    await page.goto(`${web}${caminho}`);
    await vazio("Nenhuma tarefa por aqui").waitFor();
    assert.equal(await page.locator("[data-task-id]").count(), 0);
    assert.equal(await page.locator(".e-column").count(), 0);
    await vazio("Nenhuma tarefa por aqui").getByRole("button", { name: "Criar tarefa" }).click();
    await page.getByRole("dialog").locator("form").waitFor();
  }
  await page.unrouteAll();
  console.log("OK: lista e quadro sem tarefas avisam e oferecem criar tarefa");

  await page.route(`${api}/projetos/2?_embed=tarefas`, (rota) => rota.fulfill({ json: { ...seed.projetos[1], tarefas: [] } }));
  await page.goto(`${web}/projetos/2`);
  await vazio("Este projeto ainda não tem tarefas").waitFor();
  assert.match(await page.locator(".e-sheet-footer").innerText(), /^0 tarefas$/);
  await vazio("Este projeto ainda não tem tarefas").getByRole("button", { name: "Criar tarefa" }).click();
  await page.getByRole("dialog").locator('select[name="projetoId"]').waitFor({ state: "attached" });
  assert.equal(await page.getByRole("dialog").locator('select[name="projetoId"]').inputValue(), "2");
  await page.unrouteAll();
  console.log("OK: projeto sem tarefas avisa e cria tarefa já no projeto");

  for (const caminho of ["/", "/quadro"]) {
    await page.goto(`${web}${caminho}`);
    await page.locator("[data-task-id]").first().waitFor();
    await busca().fill("sem correspondência");
    await vazio("Nenhuma tarefa encontrada").waitFor();
    assert.equal(await page.locator("[data-task-id]").count(), 0);
    assert.equal(await vazio("Nenhuma tarefa por aqui").count(), 0);
    await vazio("Nenhuma tarefa encontrada").getByRole("button", { name: "Limpar busca e filtros" }).click();
    await page.locator("[data-task-id]").first().waitFor();
    assert.equal(await page.locator("[data-task-id]").count(), seed.tarefas.length);
    assert.equal(await busca().inputValue(), "");
  }
  console.log("OK: busca sem resultado avisa na lista e no quadro, e a limpeza restaura as tarefas");

  const projetoUnico = seed.projetos.find((projeto) => seed.tarefas.filter((tarefa) => tarefa.projetoId === projeto.id).length === 1);
  const tarefaUnica = seed.tarefas.find((tarefa) => tarefa.projetoId === projetoUnico.id);
  await page.goto(`${web}/projetos/${projetoUnico.id}`);
  await page.getByRole("button", { name: `Ações de ${tarefaUnica.titulo}` }).click();
  await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir tarefa" }).click();
  await vazio("Este projeto ainda não tem tarefas").waitFor();
  assert.match(await page.locator(".e-sheet-footer").innerText(), /^0 tarefas$/);
  console.log("OK: excluir a última tarefa do projeto mostra o estado vazio");

  const semCombinacao = seed.tarefas.find((tarefa) => !seed.tarefas.some((outra) => outra.status === "concluida" && outra.titulo === tarefa.titulo));
  await page.goto(`${web}/`);
  await page.locator("[data-task-id]").first().waitFor();
  await busca().fill(semCombinacao.titulo);
  await page.getByRole("button", { name: /Status/ }).click();
  await page.getByRole("option", { name: "Concluída" }).click();
  await vazio("Nenhuma tarefa encontrada").waitFor();
  assert.match(await page.locator(".e-sheet-footer").innerText(), /^0 tarefas$/);
  await vazio("Nenhuma tarefa encontrada").getByRole("button", { name: "Limpar busca e filtros" }).click();
  await page.locator("[data-task-id]").first().waitFor();
  assert.match(await page.getByRole("button", { name: /Status/ }).innerText(), /Todos os status/);
  console.log("OK: busca e filtro combinados sem resultado avisam e são limpos juntos");

  await page.route(`${api}/projetos`, (rota) => rota.fulfill({ json: [] }));
  await page.goto(`${web}/projetos`);
  await vazio("Nenhum projeto por aqui").getByRole("button", { name: "Criar projeto" }).click();
  await page.getByRole("dialog").getByLabel(/^Nome/).waitFor();
  await page.unrouteAll();
  console.log("OK: lista de projetos vazia avisa e oferece criar projeto");

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
      if (processo.exitCode === null) {
        const encerrado = new Promise((resolve) => processo.once("exit", resolve));
        processo.kill();
        await encerrado;
      }
    }
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
