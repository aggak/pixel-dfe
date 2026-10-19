// Suíte do componente FormularioTarefa em navegador real.
// Sobe json-server com banco temporário e Vite com página de teste
// temporária fora das rotas de produção; nada é gravado no banco real.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { createServer: servidorNet } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { associacoes, comTextos, contraste, criarUi, focoVisivel, lancarNavegador } = require("./ui.cjs");
const repo = join(__dirname, "..");
const evidencias = process.env.FORMULARIO_EVIDENCIAS || "";
const ROTULOS = ["Projeto", "Título", "Descrição", "Status", "Prioridade", "Responsável", "Prazo"];
const OBRIGATORIOS = ["Projeto", "Título", "Responsável", "Prazo"];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let vite;
let processoApi;
let browser;
let paginaTeste;
let dadosTemp;
let apiUrl = "";
let origem = "";

async function conferir(nome, executar) { await executar(); console.log(`OK: ${nome}`); total++; }
async function ate(descricao, verificar, tentativas = 150) {
  for (let i = 0; i < tentativas; i++) {
    try { const valor = await verificar(); if (valor) return valor; } catch {}
    await dormir(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${descricao}`);
}
async function portaLivre() {
  const servidor = servidorNet();
  await new Promise((resolve, reject) => { servidor.once("error", reject); servidor.listen(0, "127.0.0.1", resolve); });
  const { port } = servidor.address();
  await new Promise((resolve) => servidor.close(resolve));
  return port;
}
async function encerrarApi() {
  if (processoApi && processoApi.exitCode === null) {
    const fim = new Promise((resolve) => processoApi.once("exit", resolve));
    processoApi.kill();
    await fim;
  }
}
const FIXTURE_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Teste do formulário</title></head>
<body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>`;
const FIXTURE_TSX = `import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "react-aria-components";
import { Aparencia } from "../src/components/Aparencia";
import { FormularioTarefa } from "../src/components/FormularioTarefa";
import { atualizarTarefa, criarTarefa } from "../src/api";
import type { NovaTarefa, Tarefa } from "../src/tipos";
import "../src/index.css";
import "../src/App.css";
type Janela = Window & { __payloads?: NovaTarefa[]; __cancelamentos?: number };
const janela = window as Janela;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const edicao: Tarefa = { id: "fixture-edicao-1", projetoId: "2", titulo: "Revisar modelagem", descricao: "Conferir entidades e relacionamentos", status: "em-revisao", prioridade: "alta", responsavel: "Carla", prazo: "2026-12-01" };
const existente: NovaTarefa = { projetoId: "1", titulo: "Criar o repositório", descricao: "Repositório da equipe no GitHub, com todos os integrantes", status: "concluida", prioridade: "alta", responsavel: "Ana", prazo: "2026-10-06" };
function Pagina() {
  const modo = new URLSearchParams(location.search).get("modo") || "novo";
  const [resultado, setResultado] = useState("");
  const [envios, setEnvios] = useState(0);
  const registrar = (dados: NovaTarefa) => { janela.__payloads = [...(janela.__payloads || []), dados]; setEnvios((n) => n + 1); setResultado("Salvo: " + dados.titulo); };
  const cancelar = () => { janela.__cancelamentos = (janela.__cancelamentos || 0) + 1; setResultado("Cancelado"); };
  let formulario = <FormularioTarefa onSalvar={registrar} onCancelar={cancelar} />;
  if (modo === "editar") formulario = <FormularioTarefa valoresIniciais={edicao as unknown as Partial<NovaTarefa>} textoSalvar="Atualizar tarefa" onSalvar={registrar} onCancelar={cancelar} />;
  if (modo === "erro-salvar") formulario = <FormularioTarefa onSalvar={async (dados) => { janela.__payloads = [...(janela.__payloads || []), dados]; setEnvios((n) => n + 1); await dormir(30); throw new Error("Falha simulada ao salvar"); }} onCancelar={cancelar} />;
  if (modo === "lento") formulario = <FormularioTarefa onSalvar={async (dados) => { registrar(dados); await dormir(1000); setResultado("Concluído: " + dados.titulo); }} onCancelar={cancelar} />;
  if (modo === "criar-real") formulario = <FormularioTarefa onSalvar={async (dados) => { const criada = await criarTarefa(dados); registrar(dados); setResultado("Criada: " + criada.id); }} onCancelar={cancelar} />;
  if (modo === "editar-real") formulario = <FormularioTarefa valoresIniciais={existente} textoSalvar="Atualizar tarefa" onSalvar={async (dados) => { const atualizada = await atualizarTarefa("1", dados); registrar(dados); setResultado("Atualizada: " + atualizada.id); }} onCancelar={cancelar} />;
  if (modo === "contexto") formulario = <FormularioTarefa valoresIniciais={{ projetoId: "2" }} onSalvar={registrar} />;
  if (modo === "duplo") formulario = <><FormularioTarefa onSalvar={registrar} /><FormularioTarefa onSalvar={registrar} /></>;
  if (modo === "sem-cancelar") formulario = <FormularioTarefa onSalvar={registrar} />;
  return <main><h1>Formulário de tarefa</h1>{formulario}<p data-testid="resultado">{resultado}</p><p data-testid="envios" hidden>{envios}</p></main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Aparencia><I18nProvider locale="pt-BR"><Pagina /></I18nProvider></Aparencia></StrictMode>);`;
async function executar() {
  try { await access(join(repo, "src/components/FormularioTarefa.tsx")); } catch { throw new Error("Componente ausente: src/components/FormularioTarefa.tsx"); }
  const bancoRealAntes = await readFile(join(repo, "db.json"), "utf8");
  const seedAntes = await readFile(join(repo, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedAntes);
  dadosTemp = await mkdtemp(join(tmpdir(), "pixel-formulario-"));
  const caminhoDb = join(dadosTemp, "db.json");
  await copyFile(join(repo, "db.seed.json"), caminhoDb);
  const portaApi = await portaLivre();
  apiUrl = `http://127.0.0.1:${portaApi}`;
  processoApi = spawn(process.execPath, [join(repo, "node_modules/json-server/lib/bin.js"), caminhoDb, "--host", "127.0.0.1", "--port", String(portaApi)], { windowsHide: true, stdio: "pipe" });
  processoApi.stdout.on("data", () => {});
  processoApi.stderr.on("data", (dado) => process.stderr.write(dado));
  await ate("API temporária", async () => processoApi.exitCode === null && (await fetch(`${apiUrl}/projetos`)).ok);
  paginaTeste = await mkdtemp(join(repo, ".teste-formulario-"));
  await writeFile(join(paginaTeste, "index.html"), FIXTURE_HTML);
  await writeFile(join(paginaTeste, "fixture.tsx"), FIXTURE_TSX);
  const apiAnterior = process.env.VITE_API_URL;
  process.env.VITE_API_URL = apiUrl;
  try {
    const { createServer } = await import("vite");
    vite = await createServer({ root: paginaTeste, configFile: join(repo, "vite.config.ts"), cacheDir: join(paginaTeste, ".vite"), publicDir: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0, fs: { allow: [repo] } } });
    await vite.listen();
    const endereco = vite.httpServer && vite.httpServer.address();
    if (!endereco || typeof endereco === "string") throw new Error("Vite não informou a porta da página de teste.");
    origem = `http://127.0.0.1:${endereco.port}`;
  } finally {
    if (apiAnterior === undefined) delete process.env.VITE_API_URL; else process.env.VITE_API_URL = apiAnterior;
  }
  try { browser = await lancarNavegador(); }
  catch (erro) { throw new Error(`Não foi possível abrir o navegador (${process.env.TEST_BROWSER || "chrome"}): ${erro.message}`); }
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const ui = criarUi(page);
  const campo = ui.campo;
  const opcoes = ui.opcoes;
  const controle = (rotulo) => (["Projeto", "Status", "Prioridade"].includes(rotulo) ? ui.seletor(rotulo) : campo(rotulo));
  // Opções do select real, lidas na lista visível aberta pelo botão.
  async function opcoesVisiveis(nome) {
    await ui.seletor(nome).click();
    await page.getByRole("listbox").waitFor();
    const textos = await page.getByRole("option").evaluateAll((els) => els.map((el) => (el.textContent || "").trim()));
    await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({ state: "detached" });
    return textos;
  }
  const payloads = () => page.evaluate(() => window.__payloads || []);
  const envios = async () => Number(await page.getByTestId("envios").innerText());
  const resultado = () => page.getByTestId("resultado").innerText();
  const botaoSalvar = (nome = "Salvar tarefa") => page.getByRole("button", { name: nome, exact: true });
  const botaoEnvio = () => page.locator('form button[type="submit"]');
  const lerDb = async () => JSON.parse(await readFile(caminhoDb, "utf8"));
  async function abrir(modo, aguardar = true) {
    await page.goto(`${origem}/?modo=${modo}`);
    await page.locator("form").waitFor();
    if (aguardar) await ate("projetos carregados", () => ui.projetosCarregados(seed.projetos.length));
  }
  const preencher = (dados) => ui.preencherTarefa(comTextos(dados, seed.projetos));
  const valido = { projetoId: "2", titulo: "Organizar referências", descricao: "Separar materiais por disciplina", status: "em-andamento", prioridade: "alta", responsavel: "Bruno", prazo: "2027-02-10" };
  await conferir("sete campos com rótulos exatos, enums, required e ids únicos", async () => {
    await abrir("novo");
    assert.equal(await page.locator("form").count(), 1);
    // A descrição é opcional e começa recolhida; só depois de aberta o campo existe.
    assert.equal(await campo("Descrição").count(), 0);
    await ui.abrirDescricao();
    for (const rotulo of ROTULOS) assert.equal(await controle(rotulo).count(), 1, rotulo);
    const ligacoes = await associacoes(page);
    assert.deepEqual(ligacoes.map((l) => l.texto).sort(), [...ROTULOS].sort());
    for (const ligacao of ligacoes) {
      assert.equal(ligacao.controles.length, 1, `rótulo sem um único controle associado: ${ligacao.texto}`);
      assert.ok(ligacao.controles[0].id, ligacao.texto);
      if (ligacao.para) assert.equal(ligacao.para, ligacao.controles[0].id, ligacao.texto);
      assert.equal(await page.locator(`[id="${ligacao.controles[0].id}"]`).count(), 1, ligacao.texto);
    }
    for (const rotulo of OBRIGATORIOS) assert.equal(await ui.obrigatorio(rotulo), true, rotulo);
    const ids = await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id).filter(Boolean));
    assert.equal(new Set(ids).size, ids.length, "ids duplicados na página");
    assert.deepEqual(await opcoes("Status"), [
      { value: "a-fazer", texto: "A fazer" }, { value: "em-andamento", texto: "Em andamento" },
      { value: "em-revisao", texto: "Em revisão" }, { value: "concluida", texto: "Concluída" },
    ]);
    assert.deepEqual(await opcoes("Prioridade"), [
      { value: "baixa", texto: "Baixa" }, { value: "media", texto: "Média" }, { value: "alta", texto: "Alta" },
    ]);
    assert.deepEqual(await opcoes("Projeto"), seed.projetos.map((p) => ({ value: String(p.id), texto: p.nome })));
    // As mesmas opções aparecem, na mesma ordem, na lista visível de cada select.
    assert.deepEqual(await opcoesVisiveis("Status"), ["A fazer", "Em andamento", "Em revisão", "Concluída"]);
    assert.deepEqual(await opcoesVisiveis("Prioridade"), ["Baixa", "Média", "Alta"]);
    assert.deepEqual(await opcoesVisiveis("Projeto"), seed.projetos.map((p) => p.nome));
  });
  await conferir("projetos vêm da API e não de lista fixa", async () => {
    const custom = [{ id: "custom-1", nome: "Projeto Vindo da API", descricao: "x", disciplina: "y", criadoEm: "2026-01-01" }, { id: "custom-2", nome: "Outro Projeto da API", descricao: "x", disciplina: "y", criadoEm: "2026-01-02" }];
    await page.route(`${apiUrl}/projetos`, (route) => route.fulfill({ json: custom }));
    try {
      await abrir("novo", false);
      await ate("projetos personalizados", async () => (await opcoes("Projeto")).some((o) => o.value === "custom-1"));
      assert.deepEqual(await opcoes("Projeto"), custom.map((p) => ({ value: p.id, texto: p.nome })));
      assert.deepEqual(await opcoesVisiveis("Projeto"), custom.map((p) => p.nome));
    } finally { await page.unrouteAll(); }
  });
  await conferir("valores padrão no cadastro e envio vazio bloqueado pela validação", async () => {
    await abrir("novo");
    assert.equal(await campo("Título").inputValue(), "");
    assert.equal(await ui.valor("Descrição"), "");
    assert.equal(await campo("Responsável").inputValue(), "");
    assert.equal(await campo("Prazo").inputValue(), "");
    assert.equal(await ui.valor("Status"), "a-fazer");
    assert.equal(await ui.valor("Prioridade"), "media");
    assert.ok((await ui.seletor("Status").innerText()).includes("A fazer"));
    assert.ok((await ui.seletor("Prioridade").innerText()).includes("Média"));
    assert.equal(await ui.valor("Projeto"), "", "cadastro não escolhe um projeto silenciosamente");
    assert.equal(await botaoSalvar().isEnabled(), true);
    await botaoSalvar().click();
    assert.equal((await payloads()).length, 0);
    for (const mensagem of ["Informe o título da tarefa.", "Selecione um projeto.", "Informe o responsável.", "Informe o prazo."]) await page.getByText(mensagem, { exact: true }).waitFor();
    if (evidencias) { await mkdir(evidencias, { recursive: true }); await page.screenshot({ path: join(evidencias, "formulario-novo.png") }); }
  });
  await conferir("edição preenche todos os campos no mesmo componente", async () => {
    await abrir("editar");
    assert.equal(await page.locator("form").count(), 1);
    assert.equal(await ui.valor("Projeto"), "2");
    assert.equal(await campo("Título").inputValue(), "Revisar modelagem");
    // A descrição preenchida começa aberta; fechar e reabrir mantém o texto.
    assert.equal(await ui.alternarDescricao().getAttribute("aria-expanded"), "true");
    assert.equal(await campo("Descrição").inputValue(), "Conferir entidades e relacionamentos");
    await ui.fecharDescricao();
    assert.equal(await ui.valor("Descrição"), "Conferir entidades e relacionamentos");
    assert.equal(await ui.valor("Status"), "em-revisao");
    assert.equal(await ui.valor("Prioridade"), "alta");
    assert.equal(await campo("Responsável").inputValue(), "Carla");
    assert.equal(await campo("Prazo").inputValue(), "2026-12-01");
    assert.equal(await botaoSalvar("Atualizar tarefa").count(), 1);
    assert.equal(await botaoSalvar("Salvar tarefa").count(), 0);
  });
  await conferir("callback de edição recebe NovaTarefa sem id", async () => {
    await campo("Título").fill("Modelagem revisada");
    await botaoSalvar("Atualizar tarefa").click();
    await ate("payload de edição", async () => (await payloads()).length === 1);
    const [dados] = await payloads();
    assert.ok(!("id" in dados), "payload não pode conter id");
    assert.deepEqual(dados, { projetoId: "2", titulo: "Modelagem revisada", descricao: "Conferir entidades e relacionamentos", status: "em-revisao", prioridade: "alta", responsavel: "Carla", prazo: "2026-12-01" });
    assert.ok((await resultado()).includes("Modelagem revisada"));
  });
  await conferir("Enter envia o cadastro com datas sem conversão", async () => {
    await abrir("novo");
    await preencher(valido);
    await campo("Título").press("Enter");
    await ate("payload do Enter", async () => (await payloads()).length === 1);
    const [dados] = await payloads();
    assert.ok(!("id" in dados));
    assert.deepEqual(dados, valido);
  });
  await conferir("cancelar não envia e a ação é opcional", async () => {
    await abrir("novo");
    await campo("Título").fill("Não deve ser enviada");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__cancelamentos || 0), 1);
    assert.equal((await payloads()).length, 0);
    assert.ok((await resultado()).includes("Cancelado"));
    await abrir("sem-cancelar");
    assert.equal(await page.getByRole("button", { name: "Cancelar", exact: true }).count(), 0);
  });
  await conferir("rejeição do callback preserva valores e reabilita o envio", async () => {
    await abrir("erro-salvar");
    await preencher(valido);
    await botaoSalvar().click();
    await ate("callback rejeitado executado", async () => (await envios()) === 1);
    assert.equal(await campo("Título").inputValue(), valido.titulo);
    assert.equal(await ui.valor("Descrição"), valido.descricao);
    for (const [rotulo, atributo] of [["Projeto", "projetoId"], ["Status", "status"], ["Prioridade", "prioridade"]]) assert.equal(await ui.valor(rotulo), valido[atributo], rotulo);
    assert.equal(await campo("Responsável").inputValue(), valido.responsavel);
    assert.equal(await campo("Prazo").inputValue(), valido.prazo);
    await ate("botão reabilitado", () => botaoEnvio().isEnabled());
  });
  await conferir("envio em curso bloqueia duplicidade", async () => {
    await abrir("lento");
    await preencher(valido);
    await botaoSalvar().click();
    await ate("botão bloqueado durante o envio", () => botaoEnvio().isDisabled());
    await page.evaluate(() => { const f = document.querySelector("form"); if (f) f.requestSubmit(); });
    await ate("envio concluído", async () => (await resultado()).includes("Concluído"));
    assert.equal(await envios(), 1);
    assert.equal((await payloads()).length, 1);
  });
  await conferir("projetos em carregamento, falha ou vazio bloqueiam o salvar", async () => {
    await page.route(`${apiUrl}/projetos`, async (route) => { await dormir(1200); await route.continue(); });
    await abrir("novo", false);
    await ate("bloqueado enquanto carrega", () => botaoEnvio().isDisabled());
    await ate("liberado após carregar", () => botaoEnvio().isEnabled());
    await page.unrouteAll();
    await page.route(`${apiUrl}/projetos`, (route) => route.fulfill({ status: 500, json: {} }));
    await abrir("novo", false);
    await ate("mensagem de falha dos projetos", async () => { const texto = await page.locator("body").innerText(); return /projeto/i.test(texto) && /(não foi possível|erro|falha|indispon)/i.test(texto); });
    assert.equal(await botaoEnvio().isDisabled(), true);
    await page.unrouteAll();
    await page.route(`${apiUrl}/projetos`, (route) => route.fulfill({ json: [] }));
    await abrir("novo", false);
    await ate("orientação de lista vazia", async () => /nenhum projeto/i.test(await page.locator("body").innerText()));
    assert.equal(await botaoEnvio().isDisabled(), true);
    assert.equal((await payloads()).length, 0);
    await page.unrouteAll();
  });
  await conferir("integração real cria tarefa no banco temporário", async () => {
    await abrir("criar-real");
    const dados = { ...valido, titulo: "Tarefa criada pela suíte do formulário" };
    await preencher(dados);
    await botaoSalvar().click();
    await ate("confirmação da criação", async () => (await resultado()).startsWith("Criada: "));
    const criada = await ate("tarefa na API", async () => { const lista = await (await fetch(`${apiUrl}/tarefas`)).json(); return lista.find((t) => t.titulo === dados.titulo) || null; });
    assert.equal(typeof criada.id, "string");
    assert.deepEqual({ projetoId: criada.projetoId, titulo: criada.titulo, descricao: criada.descricao, status: criada.status, prioridade: criada.prioridade, responsavel: criada.responsavel, prazo: criada.prazo }, dados);
    const gravada = await ate("tarefa no arquivo temporário", async () => (await lerDb()).tarefas.find((t) => t.id === criada.id) || null);
    assert.equal(gravada.titulo, dados.titulo);
  });
  await conferir("integração real atualiza tarefa existente preservando o id", async () => {
    await abrir("editar-real");
    assert.equal(await campo("Título").inputValue(), "Criar o repositório");
    await campo("Título").fill("Repositório atualizado pela suíte");
    await ui.escolher("Status", "Em andamento");
    await botaoSalvar("Atualizar tarefa").click();
    await ate("confirmação da atualização", async () => (await resultado()) === "Atualizada: 1");
    const atual = await (await fetch(`${apiUrl}/tarefas/1`)).json();
    assert.equal(atual.id, "1");
    assert.equal(atual.titulo, "Repositório atualizado pela suíte");
    assert.equal(atual.status, "em-andamento");
    assert.equal(atual.projetoId, "1");
    await ate("atualização no arquivo temporário", async () => (await lerDb()).tarefas.some((t) => t.id === "1" && t.titulo === "Repositório atualizado pela suíte"));
  });
  await conferir("projeto inicial isolado e duas instâncias sem conflito de rótulos", async () => {
    await abrir("contexto");
    assert.equal(await ui.valor("Projeto"), "2");
    assert.equal(await campo("Título").inputValue(), "");
    await page.goto(`${origem}/?modo=duplo`);
    await ate("duas instâncias", async () => await page.locator("form").count() === 2);
    await ate("projetos nas duas instâncias", async () => await page.locator('form select[name="projetoId"] option[value="1"]').count() === 2);
    const instancias = [0, 1].map((n) => criarUi(page, () => page.locator("form").nth(n)));
    for (const instancia of instancias) await instancia.abrirDescricao();
    // Cada instância tem os sete campos, com rótulos e controles próprios e ids únicos em toda a página.
    const porInstancia = [await associacoes(page, 0), await associacoes(page, 1)];
    for (const ligacoes of porInstancia) {
      assert.deepEqual(ligacoes.map((l) => l.texto).sort(), [...ROTULOS].sort());
      for (const ligacao of ligacoes) {
        assert.equal(ligacao.controles.length, 1, ligacao.texto);
        if (ligacao.para) assert.equal(ligacao.para, ligacao.controles[0].id, ligacao.texto);
      }
    }
    const idsControles = porInstancia.flatMap((ligacoes) => ligacoes.flatMap((l) => [l.id, l.controles[0].id]));
    assert.equal(idsControles.length, 28);
    assert.equal(new Set(idsControles).size, idsControles.length, "rótulos e controles compartilham ids entre instâncias");
    const todosIds = await page.locator("[id]").evaluateAll((els) => els.map((el) => el.id).filter(Boolean));
    assert.equal(new Set(todosIds).size, todosIds.length, "ids duplicados na página");
    for (const rotulo of ROTULOS) for (const instancia of instancias) {
      assert.equal(await (["Projeto", "Status", "Prioridade"].includes(rotulo) ? instancia.seletor(rotulo) : instancia.campo(rotulo)).count(), 1, rotulo);
    }
    // Digitar em uma instância não altera a outra.
    await instancias[0].campo("Título").fill("Somente na primeira");
    assert.equal(await instancias[1].campo("Título").inputValue(), "");
  });

  await conferir("projeto removido da API impede salvar até escolher outro", async () => {
    await page.route(`${apiUrl}/projetos`, (route) => route.fulfill({ json: [seed.projetos[0]] }));
    try {
      await abrir("editar", false);
      await page.getByText("O projeto desta tarefa não foi encontrado. Escolha um projeto disponível.", { exact: true }).waitFor();
      assert.equal(await botaoEnvio().isDisabled(), true);
      await page.locator("form").evaluate((f) => f.requestSubmit());
      assert.equal((await payloads()).length, 0);
      await ui.escolher("Projeto", seed.projetos[0].nome);
      assert.equal(await ui.valor("Projeto"), "1");
      await botaoEnvio().click();
      await ate("envio com projeto disponível", async () => (await payloads()).length === 1);
      assert.equal((await payloads())[0].projetoId, "1");
    } finally { await page.unrouteAll(); }
  });

  await conferir("botão legível nos temas claro e escuro", async () => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const fundos = {};
    const classesTema = () => page.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), darkMode: document.documentElement.classList.contains("dark-mode") }));
    for (const tema of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: tema });
      await abrir("editar");
      // Os provedores de produção alternam as classes de tema de verdade.
      assert.deepEqual(await classesTema(), { dark: tema === "dark", darkMode: tema === "dark" }, tema);
      // As cores têm transição: só se mede depois que nenhuma animação CSS está em curso.
      await page.waitForFunction(() => document.getAnimations().length === 0);
      const cores = await botaoEnvio().evaluate((el) => ({ texto: getComputedStyle(el).color, fundo: getComputedStyle(el).backgroundColor }));
      fundos[tema] = await campo("Título").evaluate((el) => `${getComputedStyle(el).color} | ${getComputedStyle(document.body).backgroundColor} | ${getComputedStyle(el.closest("form")).color}`);
      assert.ok(contraste(cores.texto, cores.fundo) >= 4.5, `${tema}: ${cores.texto} sobre ${cores.fundo}`);
      if (evidencias) await page.screenshot({ path: join(evidencias, `formulario-${tema}.png`), fullPage: true });
    }
    assert.notEqual(fundos.light, fundos.dark, "o tema escuro deve mudar as cores do texto e do fundo");
    // A troca de preferência em tempo de execução também é refletida sem recarregar.
    await page.emulateMedia({ colorScheme: "light" });
    await ate("tema claro restaurado", async () => (await classesTema()).dark === false);
  });

  await conferir("largura de 320px sem overflow e navegação por teclado", async () => {
    await page.setViewportSize({ width: 320, height: 700 });
    await abrir("novo");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth), true);
    await page.locator("form label", { hasText: "Responsável" }).click();
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), await campo("Responsável").evaluate((el) => el.id));
    assert.equal(await focoVisivel(campo("Responsável")), true);
    let alcancouBotao = false;
    for (let i = 0; i < 8 && !alcancouBotao; i++) {
      await page.keyboard.press("Tab");
      alcancouBotao = await page.evaluate(() => document.activeElement instanceof HTMLButtonElement && document.activeElement.closest("form") !== null);
    }
    assert.equal(alcancouBotao, true, "Tab deve alcançar um botão do formulário");
    if (evidencias) { await mkdir(evidencias, { recursive: true }); await page.screenshot({ path: join(evidencias, "formulario-320.png"), fullPage: true }); }
  });
  await conferir("sem erros de página e bancos reais intactos", async () => {
    assert.deepEqual(errosPagina, []);
    assert.equal(await readFile(join(repo, "db.json"), "utf8"), bancoRealAntes);
    assert.equal(await readFile(join(repo, "db.seed.json"), "utf8"), seedAntes);
  });
  console.log(`${total} cenários aprovados; banco real intacto.`);
}
executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close().catch(() => {});
  await vite?.close().catch(() => {});
  await encerrarApi().catch(() => {});
  if (paginaTeste) await rm(paginaTeste, { recursive: true, force: true });
  if (dadosTemp) await rm(dadosTemp, { recursive: true, force: true });
});
