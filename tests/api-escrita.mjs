import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as criarServidorNet } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let vite;
let processoApi;
let temporario;
const urlAnterior = process.env.VITE_API_URL;

async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}

async function portaLivre() {
  const servidor = criarServidorNet();
  await new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(0, "127.0.0.1", resolve);
  });
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}

async function esperarApi(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processoApi.exitCode !== null) throw new Error("json-server encerrou antes do teste.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await dormir(100);
  }
  throw new Error(`API indisponível: ${url}`);
}

async function esperarGravacao(caminhoDb, condicao) {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    try {
      const db = JSON.parse(await readFile(caminhoDb, "utf8"));
      if (condicao(db)) return db;
    } catch {}
    await dormir(100);
  }
  throw new Error("Arquivo temporário não refletiu as escritas.");
}

async function encerrarApi() {
  if (processoApi && processoApi.exitCode === null) {
    const fim = new Promise((resolve) => processoApi.once("exit", resolve));
    processoApi.kill();
    await fim;
  }
}

async function executar() {
  const bancoRealAntes = await readFile(join(raiz, "db.json"), "utf8");
  const seedAntes = await readFile(join(raiz, "db.seed.json"), "utf8");
  temporario = await mkdtemp(join(tmpdir(), "pixel-api-escrita-"));
  const caminhoDb = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), caminhoDb);
  const porta = await portaLivre();
  const apiUrl = `http://127.0.0.1:${porta}`;
  const binJsonServer = join(raiz, "node_modules/json-server/lib/bin.js");
  processoApi = spawn(process.execPath, [binJsonServer, caminhoDb, "--host", "127.0.0.1", "--port", String(porta)], { windowsHide: true, stdio: "pipe" });
  processoApi.stdout.on("data", () => {});
  processoApi.stderr.on("data", (dado) => process.stderr.write(dado));
  await esperarApi(`${apiUrl}/tarefas`);
  process.env.VITE_API_URL = apiUrl;
  vite = await createServer({ root: raiz, cacheDir: join(temporario, ".vite"), logLevel: "silent", server: { middlewareMode: true, hmr: false } });
  const api = await vite.ssrLoadModule("/src/api.ts");
  for (const nome of ["criarTarefa", "atualizarTarefa", "criarProjeto", "atualizarProjeto"]) {
    if (typeof api[nome] !== "function") throw new Error(`Função ausente em src/api.ts: ${nome}`);
  }

  const dadosProjeto = {
    nome: "Projeto API de Escrita",
    descricao: "Criado pelo teste automatizado",
    disciplina: "Desenvolvimento Frontend",
    criadoEm: "2026-10-18",
  };
  let projetoCriado;
  let tarefaCriada;
  let dadosTarefa;

  await conferir("criarProjeto cria sem ID e devolve projeto completo", async () => {
    assert.ok(!("id" in dadosProjeto));
    projetoCriado = await api.criarProjeto(dadosProjeto);
    assert.equal(typeof projetoCriado.id, "string");
    assert.ok(projetoCriado.id.length > 0);
    assert.deepEqual(projetoCriado, { ...dadosProjeto, id: projetoCriado.id });
  });

  await conferir("criarTarefa cria sem ID e devolve tarefa completa", async () => {
    dadosTarefa = {
      projetoId: projetoCriado.id,
      titulo: "Testar escrita da API",
      descricao: "POST e PATCH via módulo real",
      status: "a-fazer",
      prioridade: "media",
      responsavel: "Ana",
      prazo: "2026-11-05",
    };
    assert.ok(!("id" in dadosTarefa));
    tarefaCriada = await api.criarTarefa(dadosTarefa);
    assert.equal(typeof tarefaCriada.id, "string");
    assert.ok(tarefaCriada.id.length > 0);
    assert.deepEqual(tarefaCriada, { ...dadosTarefa, id: tarefaCriada.id });
  });

  await conferir("leitura após escrita confirma tarefa e projeto", async () => {
    assert.deepEqual(await api.buscarTarefa(tarefaCriada.id), tarefaCriada);
    assert.deepEqual(await api.buscarProjeto(projetoCriado.id), projetoCriado);
  });

  await conferir("atualizarTarefa parcial mantém campos, ID e vínculo", async () => {
    const atualizada = await api.atualizarTarefa(tarefaCriada.id, { status: "em-andamento", prioridade: "alta" });
    assert.deepEqual(atualizada, { ...tarefaCriada, status: "em-andamento", prioridade: "alta" });
    assert.deepEqual(await api.buscarTarefa(tarefaCriada.id), atualizada);
    tarefaCriada = atualizada;
  });

  await conferir("atualizarProjeto parcial mantém campos e ID", async () => {
    const atualizado = await api.atualizarProjeto(projetoCriado.id, { disciplina: "Desenvolvimento Frontend II" });
    assert.deepEqual(atualizado, { ...projetoCriado, disciplina: "Desenvolvimento Frontend II" });
    assert.deepEqual(await api.buscarProjeto(projetoCriado.id), atualizado);
    projetoCriado = atualizado;
  });

  await conferir("persistência grava criações e atualizações no arquivo temporário", async () => {
    const gravou = (atual) => atual.tarefas.some((t) => t.id === tarefaCriada.id && t.status === "em-andamento") && atual.projetos.some((p) => p.id === projetoCriado.id && p.disciplina === "Desenvolvimento Frontend II");
    const db = await esperarGravacao(caminhoDb, gravou);
    assert.deepEqual(db.tarefas.find((t) => t.id === tarefaCriada.id), tarefaCriada);
    assert.deepEqual(db.projetos.find((p) => p.id === projetoCriado.id), projetoCriado);
  });

  await conferir("listarTarefasDoProjeto retorna só tarefas do projeto via _embed", async () => {
    const outra = await api.criarTarefa({ ...dadosTarefa, titulo: "Segunda tarefa do projeto" });
    const lista = await api.listarTarefasDoProjeto(projetoCriado.id);
    assert.deepEqual(lista.map((t) => t.id).sort(), [tarefaCriada.id, outra.id].sort());
    assert.ok(lista.every((t) => t.projetoId === projetoCriado.id));
    const doSeed = await api.listarTarefasDoProjeto("1");
    assert.ok(doSeed.length > 0 && doSeed.every((t) => t.projetoId === "1"));
    assert.ok(!doSeed.some((t) => t.id === tarefaCriada.id || t.id === outra.id));
  });

  await conferir("atualizações de IDs inexistentes rejeitam com ErroApi 404", async () => {
    const eh404 = (erro) => erro instanceof api.ErroApi && erro.status === 404;
    await assert.rejects(api.atualizarTarefa("inexistente-404", { titulo: "Sem destino" }), eh404);
    await assert.rejects(api.atualizarProjeto("inexistente-404", { nome: "Sem destino" }), eh404);
  });

  await conferir("métodos e ID especial são codificados na URL (fetch controlado)", async () => {
    const fetchOriginal = globalThis.fetch;
    const chamadas = [];
    globalThis.fetch = async (url, init) => {
      chamadas.push({ url: String(url), metodo: init?.method });
      return new Response(JSON.stringify({ id: "controlado" }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    try {
      await api.criarTarefa(dadosTarefa);
      await api.atualizarProjeto("a/b c?d#e", { nome: "Controlado" });
    } finally {
      globalThis.fetch = fetchOriginal;
    }
    assert.equal(globalThis.fetch, fetchOriginal);
    assert.deepEqual(chamadas, [
      { url: `${apiUrl}/tarefas`, metodo: "POST" },
      { url: `${apiUrl}/projetos/a%2Fb%20c%3Fd%23e`, metodo: "PATCH" },
    ]);
  });

  await conferir("sinal já abortado cancela criação e atualização", async () => {
    const controle = new AbortController();
    controle.abort();
    const ehAbort = (erro) => erro?.name === "AbortError";
    await assert.rejects(api.criarTarefa(dadosTarefa, controle.signal), ehAbort);
    await assert.rejects(api.atualizarProjeto(projetoCriado.id, { nome: "Cancelado" }, controle.signal), ehAbort);
  });

  await conferir("servidor parado rejeita escrita e leitura", async () => {
    await encerrarApi();
    await assert.rejects(api.criarTarefa(dadosTarefa));
    await assert.rejects(api.listarTarefas());
  });

  await conferir("banco real permanece intacto", async () => {
    assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoRealAntes);
    assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedAntes);
  });

  console.log(`${total} cenários aprovados; banco real intacto.`);
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await vite?.close().catch(() => {});
    await encerrarApi().catch(() => {});
    if (urlAnterior === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = urlAnterior;
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
