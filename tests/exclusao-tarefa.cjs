// Fluxo da issue #42 com API real e banco temporário.
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
  const tarefas = JSON.parse(seedOriginal).tarefas;
  temporario = await mkdtemp(join(tmpdir(), "pixel-exclusao-"));
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
  const exclusoes = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  page.on("request", (requisicao) => { if (requisicao.method() === "DELETE") exclusoes.push(requisicao.url()); });
  const cartao = (tarefa) => page.locator(`[data-task-id="${tarefa.id}"]`);
  const dialogo = (tarefa) => page.getByRole("dialog", { name: `Excluir ${tarefa.titulo}` });
  const abrir = async (tarefa) => {
    await cartao(tarefa).getByRole("button", { name: `Ações de ${tarefa.titulo}` }).click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    await dialogo(tarefa).waitFor();
  };
  const confirmar = async (tarefa) => dialogo(tarefa).getByRole("button", { name: "Excluir tarefa" }).click();
  const existeNaApi = async (tarefa) => (await fetch(`${api}/tarefas/${tarefa.id}`)).ok;
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
  await page.route(urlFalha, (rota) => rota.request().method() === "DELETE" ? rota.fulfill({ status: 500, body: "{}" }) : rota.continue());
  await abrir(naLista);
  await confirmar(naLista);
  await dialogo(naLista).getByRole("alert").waitFor();
  assert.equal(await cartao(naLista).count(), 1);
  assert.equal(await existeNaApi(naLista), true);
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${tarefas.length} tarefas`);
  await page.unroute(urlFalha);
  console.log("OK: falha da API avisa e mantém a tarefa e a contagem");

  await confirmar(naLista);
  await cartao(naLista).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(naLista), false);
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${tarefas.length - 1} tarefas`);
  await page.reload();
  await page.getByRole("region", { name: "Lista de tarefas" }).waitFor();
  assert.equal(await cartao(naLista).count(), 0);
  console.log("OK: sucesso remove da API, da lista e do rodapé, inclusive após recarregar");

  await page.goto(`${web}/quadro`);
  await cartao(noQuadro).waitFor();
  await abrir(noQuadro);
  await confirmar(noQuadro);
  await cartao(noQuadro).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(noQuadro), false);
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${tarefas.length - 2} tarefas`);
  console.log("OK: exclusão também atualiza o quadro");

  await page.goto(`${web}/projetos/${noProjeto.projetoId}`);
  await cartao(noProjeto).waitFor();
  const totalProjeto = await page.locator(".e-list [data-task-id]").count();
  await abrir(noProjeto);
  await confirmar(noProjeto);
  await cartao(noProjeto).waitFor({ state: "detached" });
  assert.equal(await existeNaApi(noProjeto), false);
  assert.equal(await page.locator(".e-sheet-footer").innerText(), `${totalProjeto - 1} ${(totalProjeto - 1) === 1 ? "tarefa" : "tarefas"}`);
  console.log("OK: exclusão também atualiza a página do projeto");

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  console.log("OK: sem erros JavaScript e sem alterações nos bancos locais");
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
