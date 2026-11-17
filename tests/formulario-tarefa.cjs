const assert = require("node:assert/strict");
const { access, mkdir, readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

const {
  associacoes,
  comTextos,
  contraste,
  criarUi,
  focoVisivel,
  criarEsperas,
} = require("./ui.cjs");
const { criarApoio } = require("./apoio.cjs");
const apoio = criarApoio();

const repo = join(__dirname, "..");
const evidencias = process.env.FORMULARIO_EVIDENCIAS || "";
const ROTULOS = [
  "Projeto",
  "Título",
  "Descrição",
  "Status",
  "Prioridade",
  "Responsável",
  "Prazo",
];
const OBRIGATORIOS = ["Projeto", "Título", "Responsável", "Prazo"];
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let total = 0;
let vite;
let browser;
let paginaTeste;
let apiUrl = "";
let origem = "";

async function conferir(nome, executar) {
  await executar();
  console.log(`OK: ${nome}`);
  total++;
}
async function ate(descricao, verificar, tentativas = 150) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const valor = await verificar();
      if (valor) return valor;
    } catch {}
    await dormir(100);
  }
  throw new Error(`Tempo esgotado aguardando: ${descricao}`);
}
const FIXTURE_HTML = `<!doctype html>
<html lang="pt-BR" class="dark dark-mode"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Teste do formulário</title></head>
<body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>`;
const FIXTURE_TSX = `import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "react-aria-components";
import { MemoryRouter } from "react-router";
import { FormularioTarefa } from "../src/components/FormularioTarefa";
import { atualizarTarefa, criarTarefa } from "../src/api";
import type { NovaTarefa, Tarefa } from "../src/tipos";
import "../src/index.css";
import "../src/App.css";
type Janela = Window & { __payloads?: NovaTarefa[]; __cancelamentos?: number; __liberarEnvio?: () => void };
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
  if (modo === "editar-prazo-invalido") formulario = <FormularioTarefa valoresIniciais={{ ...edicao, prazo: "20265-12-20" } as unknown as Partial<NovaTarefa>} textoSalvar="Atualizar tarefa" onSalvar={registrar} onCancelar={cancelar} />;
  if (modo === "erro-salvar") formulario = <FormularioTarefa onSalvar={async (dados) => { janela.__payloads = [...(janela.__payloads || []), dados]; setEnvios((n) => n + 1); await dormir(30); throw new Error("Falha simulada ao salvar"); }} onCancelar={cancelar} />;
  if (modo === "lento") formulario = <FormularioTarefa onSalvar={async (dados) => { registrar(dados); await new Promise<void>((r) => { janela.__liberarEnvio = r; }); setResultado("Concluído: " + dados.titulo); }} onCancelar={cancelar} />;
  if (modo === "criar-real") formulario = <FormularioTarefa onSalvar={async (dados) => { const criada = await criarTarefa(dados); registrar(dados); setResultado("Criada: " + criada.id); }} onCancelar={cancelar} />;
  if (modo === "editar-real") formulario = <FormularioTarefa valoresIniciais={existente} textoSalvar="Atualizar tarefa" onSalvar={async (dados) => { const atualizada = await atualizarTarefa("1", dados); registrar(dados); setResultado("Atualizada: " + atualizada.id); }} onCancelar={cancelar} />;
  if (modo === "contexto") formulario = <FormularioTarefa valoresIniciais={{ projetoId: "2" }} onSalvar={registrar} />;
  if (modo === "duplo") formulario = <><FormularioTarefa onSalvar={registrar} /><FormularioTarefa onSalvar={registrar} /></>;
  if (modo === "sem-cancelar") formulario = <FormularioTarefa onSalvar={registrar} />;
  return <main><h1>Formulário de tarefa</h1>{formulario}<p data-testid="resultado">{resultado}</p><p data-testid="envios" hidden>{envios}</p></main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><I18nProvider locale="pt-BR"><MemoryRouter><Pagina /></MemoryRouter></I18nProvider></StrictMode>);`;
async function executar() {
  try {
    await access(join(repo, "src/components/FormularioTarefa.tsx"));
  } catch {
    throw new Error("Componente ausente: src/components/FormularioTarefa.tsx");
  }
  const bancoRealAntes = await readFile(join(repo, "db.json"), "utf8");
  const seedAntes = await readFile(join(repo, "db.seed.json"), "utf8");
  const seed = JSON.parse(seedAntes);
  const { banco: caminhoDb } = await apoio.criarBanco({
    prefixo: "pixel-formulario-",
  });
  const portaApi = await apoio.portaLivre();
  apiUrl = `http://127.0.0.1:${portaApi}`;
  apoio.iniciarApi(caminhoDb, portaApi);
  await apoio.esperar(`${apiUrl}/projetos`, { tentativas: 150 });
  paginaTeste = await apoio.criarTemporario(".teste-formulario-", repo);
  await writeFile(join(paginaTeste, "index.html"), FIXTURE_HTML);
  await writeFile(join(paginaTeste, "fixture.tsx"), FIXTURE_TSX);
  const apiAnterior = process.env.VITE_API_URL;
  process.env.VITE_API_URL = apiUrl;
  try {
    const { createServer } = await import("vite");
    vite = apoio.registrar(
      await createServer({
        root: paginaTeste,
        configFile: join(repo, "vite.config.ts"),
        cacheDir: join(paginaTeste, ".vite"),
        publicDir: false,
        logLevel: "silent",
        server: { host: "127.0.0.1", port: 0, fs: { allow: [repo] } },
      }),
    );
    await vite.listen();
    const endereco = vite.httpServer && vite.httpServer.address();
    if (!endereco || typeof endereco === "string")
      throw new Error("Vite não informou a porta da página de teste.");
    origem = `http://127.0.0.1:${endereco.port}`;
  } finally {
    if (apiAnterior === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = apiAnterior;
  }
  try {
    browser = await apoio.abrirNavegador();
  } catch (erro) {
    throw new Error(
      `Não foi possível abrir o navegador (${process.env.TEST_BROWSER || "chrome"}): ${erro.message}`,
    );
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const ui = criarUi(page);
  const campo = ui.campo;
  const opcoes = ui.opcoes;
  const controle = (rotulo) =>
    ["Projeto", "Status", "Prioridade"].includes(rotulo)
      ? ui.seletor(rotulo)
      : campo(rotulo);
  async function opcoesVisiveis(nome) {
    await ui.seletor(nome).click();
    await page.getByRole("listbox").waitFor();
    const textos = await page
      .getByRole("option")
      .evaluateAll((els) => els.map((el) => (el.textContent || "").trim()));
    await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({ state: "detached" });
    return textos;
  }
  const payloads = () => page.evaluate(() => window.__payloads || []);
  const envios = async () =>
    Number(await page.getByTestId("envios").innerText());
  const resultado = () => page.getByTestId("resultado").innerText();
  const botaoSalvar = (nome = "Salvar tarefa") =>
    page.getByRole("button", { name: nome, exact: true });
  const botaoEnvio = () => page.locator('form button[type="submit"]');
  const lerDb = async () => JSON.parse(await readFile(caminhoDb, "utf8"));
  async function abrir(modo, aguardar = true) {
    await page.goto(`${origem}/?modo=${modo}`);
    await page.locator("form").waitFor();
    if (aguardar)
      await ate("projetos carregados", () =>
        ui.projetosCarregados(seed.projetos.length),
      );
  }
  const preencher = (dados) =>
    ui.preencherTarefa(comTextos(dados, seed.projetos));
  const { segurar } = criarEsperas(page);
  const valido = {
    projetoId: "2",
    titulo: "Organizar referências",
    descricao: "Separar materiais por disciplina",
    status: "em-andamento",
    prioridade: "alta",
    responsavel: "Bruno",
    prazo: "2027-02-10",
  };
  await conferir(
    "sete campos com rótulos exatos, enums, required e ids únicos",
    async () => {
      await abrir("novo");
      assert.equal(await page.locator("form").count(), 1);
      assert.equal(await campo("Descrição").count(), 0);
      await ui.abrirDescricao();
      for (const rotulo of ROTULOS)
        assert.equal(await controle(rotulo).count(), 1, rotulo);
      const ligacoes = await associacoes(page);
      assert.deepEqual(
        ligacoes.map((l) => l.texto).sort(),
        [...ROTULOS].sort(),
      );
      for (const ligacao of ligacoes) {
        assert.equal(
          ligacao.controles.length,
          1,
          `rótulo sem um único controle associado: ${ligacao.texto}`,
        );
        assert.ok(ligacao.controles[0].id, ligacao.texto);
        if (ligacao.para)
          assert.equal(ligacao.para, ligacao.controles[0].id, ligacao.texto);
        assert.equal(
          await page.locator(`[id="${ligacao.controles[0].id}"]`).count(),
          1,
          ligacao.texto,
        );
      }
      for (const rotulo of OBRIGATORIOS)
        assert.equal(await ui.obrigatorio(rotulo), true, rotulo);
      const ids = await page.evaluate(() =>
        [...document.querySelectorAll("[id]")].map((e) => e.id).filter(Boolean),
      );
      assert.equal(new Set(ids).size, ids.length, "ids duplicados na página");
      assert.deepEqual(await opcoes("Status"), [
        { value: "a-fazer", texto: "A fazer" },
        { value: "em-andamento", texto: "Em andamento" },
        { value: "em-revisao", texto: "Em revisão" },
        { value: "concluida", texto: "Concluída" },
      ]);
      assert.deepEqual(await opcoes("Prioridade"), [
        { value: "baixa", texto: "Baixa" },
        { value: "media", texto: "Média" },
        { value: "alta", texto: "Alta" },
      ]);
      assert.deepEqual(
        await opcoes("Projeto"),
        seed.projetos.map((p) => ({ value: String(p.id), texto: p.nome })),
      );
      assert.deepEqual(await opcoesVisiveis("Status"), [
        "A fazer",
        "Em andamento",
        "Em revisão",
        "Concluída",
      ]);
      assert.deepEqual(await opcoesVisiveis("Prioridade"), [
        "Baixa",
        "Média",
        "Alta",
      ]);
      assert.deepEqual(
        await opcoesVisiveis("Projeto"),
        seed.projetos.map((p) => p.nome),
      );
    },
  );
  await conferir("projetos vêm da API e não de lista fixa", async () => {
    const custom = [
      {
        id: "custom-1",
        nome: "Projeto Vindo da API",
        descricao: "x",
        disciplina: "y",
        criadoEm: "2026-01-01",
      },
      {
        id: "custom-2",
        nome: "Outro Projeto da API",
        descricao: "x",
        disciplina: "y",
        criadoEm: "2026-01-02",
      },
    ];
    await page.route(`${apiUrl}/projetos`, (route) =>
      route.fulfill({ json: custom }),
    );
    try {
      await abrir("novo", false);
      await ate("projetos personalizados", async () =>
        (await opcoes("Projeto")).some((o) => o.value === "custom-1"),
      );
      assert.deepEqual(
        await opcoes("Projeto"),
        custom.map((p) => ({ value: p.id, texto: p.nome })),
      );
      assert.deepEqual(
        await opcoesVisiveis("Projeto"),
        custom.map((p) => p.nome),
      );
    } finally {
      await page.unrouteAll();
    }
  });
  await conferir(
    "valores padrão no cadastro e envio vazio bloqueado pela validação",
    async () => {
      await abrir("novo");
      assert.equal(await campo("Título").inputValue(), "");
      assert.equal(await ui.valor("Descrição"), "");
      assert.equal(await campo("Responsável").inputValue(), "");
      assert.equal(await campo("Prazo").inputValue(), "");
      assert.equal(await ui.valor("Status"), "a-fazer");
      assert.equal(await ui.valor("Prioridade"), "media");
      assert.ok((await ui.seletor("Status").innerText()).includes("A fazer"));
      assert.ok((await ui.seletor("Prioridade").innerText()).includes("Média"));
      assert.equal(
        await ui.valor("Projeto"),
        "",
        "cadastro não escolhe um projeto silenciosamente",
      );
      assert.equal(await botaoSalvar().isEnabled(), true);
      await botaoSalvar().click();
      assert.equal((await payloads()).length, 0);
      for (const mensagem of [
        "Informe o título da tarefa.",
        "Selecione um projeto.",
        "Informe o responsável.",
        "Informe o prazo.",
      ])
        await page.getByText(mensagem, { exact: true }).waitFor();
      if (evidencias) {
        await mkdir(evidencias, { recursive: true });
        await page.screenshot({
          path: join(evidencias, "formulario-novo.png"),
        });
      }
    },
  );
  await conferir(
    "projeto vazio expõe estado inválido, descrição do erro e foco até a correção por teclado",
    async () => {
      await abrir("novo");
      const seletor = ui.seletor("Projeto");
      assert.equal(await seletor.getAttribute("aria-invalid"), null);
      await campo("Título").fill("Validar projeto obrigatório");
      await botaoSalvar().click();
      await page.getByText("Selecione um projeto.", { exact: true }).waitFor();
      await ate("foco no projeto inválido", () =>
        seletor.evaluate((el) => el === document.activeElement),
      );
      assert.equal(await seletor.getAttribute("aria-invalid"), "true");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await focoVisivel(seletor), true);
      const descricao = await seletor.getAttribute("aria-describedby");
      assert.equal(
        await page.locator(`[id="${descricao}"]`).innerText(),
        "Selecione um projeto.",
      );
      assert.equal(
        await page.locator(`[id="${descricao}"]`).getAttribute("role"),
        "alert",
      );
      assert.equal((await payloads()).length, 0);
      await seletor.press("ArrowDown");
      await page.getByRole("listbox").waitFor();
      await page.keyboard.press("Home");
      await page.keyboard.press("Enter");
      await page.getByRole("listbox").waitFor({ state: "detached" });
      assert.equal(await ui.valor("Projeto"), seed.projetos[0].id);
      assert.equal(await seletor.getAttribute("aria-invalid"), null);
      assert.equal(await seletor.getAttribute("aria-describedby"), null);
      assert.equal(
        await page.getByText("Selecione um projeto.", { exact: true }).count(),
        0,
      );
    },
  );
  await conferir(
    "validação preserva o calendário, reserva espaço para ícones e usa a cor de erro do tema",
    async () => {
      const corErro = "rgb(250, 155, 145)";
      assert.ok(contraste(corErro, "rgb(59, 45, 69)") >= 4.5);
      for (const largura of [320, 375, 1280])
        for (const modo of ["novo", "editar"]) {
          await page.setViewportSize({ width: largura, height: 900 });
          await abrir(modo);
          const paddingNormal = await campo("Título").evaluate(
            (el) => getComputedStyle(el).paddingRight,
          );
          for (const rotulo of ["Título", "Responsável", "Prazo"])
            await campo(rotulo).fill("");
          await botaoEnvio().click();
          await page.getByText("Informe o prazo.", { exact: true }).waitFor();
          for (const rotulo of ["Título", "Responsável", "Prazo"])
            for (const focado of [false, true]) {
              if (focado) await campo(rotulo).focus();
              else await botaoEnvio().focus();
              const estado = await campo(rotulo).evaluate((el) => {
                const grupo = el.parentElement;
                const icone = grupo.querySelector(".text-fg-error-secondary");
                const mensagem = document.getElementById(
                  el.getAttribute("aria-describedby"),
                );
                const estilo = getComputedStyle(el);
                return {
                  invalido: el.getAttribute("aria-invalid"),
                  mensagem: mensagem?.textContent,
                  corMensagem: mensagem && getComputedStyle(mensagem).color,
                  iconeVisivel: getComputedStyle(icone).display !== "none",
                  corIcone: getComputedStyle(icone).color,
                  reserva:
                    icone.getBoundingClientRect().left -
                    (el.getBoundingClientRect().right -
                      parseFloat(estilo.paddingRight)),
                  corContorno:
                    el.name === "titulo"
                      ? getComputedStyle(grupo).borderBottomColor
                      : getComputedStyle(grupo)
                          .getPropertyValue("--tw-ring-color")
                          .trim(),
                };
              });
              assert.equal(estado.invalido, "true", rotulo);
              assert.ok(estado.mensagem, rotulo);
              assert.equal(estado.corMensagem, corErro, rotulo);
              assert.equal(
                estado.corContorno,
                rotulo === "Título" ? corErro : "#fa9b91",
                `${rotulo}, foco: ${focado}`,
              );
              assert.equal(estado.iconeVisivel, rotulo !== "Prazo", rotulo);
              if (focado)
                assert.equal(await focoVisivel(campo(rotulo)), true, rotulo);
              if (rotulo !== "Prazo") {
                assert.equal(estado.corIcone, corErro, rotulo);
                assert.ok(
                  estado.reserva >= 4,
                  `${rotulo}: ${estado.reserva}px de reserva`,
                );
              }
            }
          await campo("Prazo").fill("2027-02-10");
          await campo("Título").fill("Título corrigido");
          assert.notEqual(
            await campo("Prazo").getAttribute("aria-invalid"),
            "true",
          );
          assert.equal(await campo("Prazo").inputValue(), "2027-02-10");
          assert.equal(
            await campo("Título").evaluate(
              (el) => getComputedStyle(el).paddingRight,
            ),
            paddingNormal,
          );
          assert.equal((await payloads()).length, 0);
        }
    },
  );
  await conferir(
    "edição preenche todos os campos no mesmo componente",
    async () => {
      await abrir("editar");
      assert.equal(await page.locator("form").count(), 1);
      assert.equal(await ui.valor("Projeto"), "2");
      assert.equal(await campo("Título").inputValue(), "Revisar modelagem");
      assert.equal(
        await ui.alternarDescricao().getAttribute("aria-expanded"),
        "true",
      );
      assert.equal(
        await campo("Descrição").inputValue(),
        "Conferir entidades e relacionamentos",
      );
      await ui.fecharDescricao();
      assert.equal(
        await ui.valor("Descrição"),
        "Conferir entidades e relacionamentos",
      );
      assert.equal(await ui.valor("Status"), "em-revisao");
      assert.equal(await ui.valor("Prioridade"), "alta");
      assert.equal(await campo("Responsável").inputValue(), "Carla");
      assert.equal(await campo("Prazo").inputValue(), "2026-12-01");
      assert.equal(await botaoSalvar("Atualizar tarefa").count(), 1);
      assert.equal(await botaoSalvar("Salvar tarefa").count(), 0);
    },
  );
  await conferir("callback de edição recebe NovaTarefa sem id", async () => {
    await campo("Título").fill("Modelagem revisada");
    await botaoSalvar("Atualizar tarefa").click();
    await ate("payload de edição", async () => (await payloads()).length === 1);
    const [dados] = await payloads();
    assert.ok(!("id" in dados), "payload não pode conter id");
    assert.deepEqual(dados, {
      projetoId: "2",
      titulo: "Modelagem revisada",
      descricao: "Conferir entidades e relacionamentos",
      status: "em-revisao",
      prioridade: "alta",
      responsavel: "Carla",
      prazo: "2026-12-01",
    });
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
  await conferir(
    "prazo vazio mantém valor vazio e o esmaecimento é só do WebKit",
    async () => {
      await campo("Prazo").fill("");
      assert.equal(await campo("Prazo").inputValue(), "");
      assert.equal(await campo("Prazo").getAttribute("value"), "");
      assert.equal(
        await page.evaluate(() => CSS.supports("(-webkit-hyphens:none)")),
        false,
      );
      const regra = await page.evaluate(() =>
        [...document.styleSheets]
          .flatMap((f) => [...f.cssRules])
          .some(
            (r) =>
              r.cssText.includes('input[type="date"][value=""]') &&
              r.cssText.includes("-webkit-hyphens"),
          ),
      );
      assert.equal(
        regra,
        true,
        "regra do campo de data vazio fica atrás de @supports do WebKit",
      );
    },
  );
  await conferir(
    "prazo com ano de mais de quatro dígitos é recusado ao salvar, no cadastro e na edição",
    async () => {
      const invalida = "Informe uma data válida.";
      const focoNoPrazo = () =>
        campo("Prazo").evaluate((el) => el === document.activeElement);
      await abrir("novo");
      await preencher(valido);
      await campo("Prazo").focus();
      await page.keyboard.type("121220265");
      assert.equal(
        await campo("Prazo").inputValue(),
        "20265-12-12",
        "dia e mês iguais dispensam a ordem dos segmentos; o quinto dígito entra no ano",
      );
      await botaoSalvar().click();
      await page.getByText(invalida, { exact: true }).waitFor();
      assert.equal((await payloads()).length, 0);
      assert.equal(await campo("Prazo").getAttribute("aria-invalid"), "true");
      assert.equal(
        await page
          .locator(
            `[id="${await campo("Prazo").getAttribute("aria-describedby")}"]`,
          )
          .innerText(),
        invalida,
      );
      await ate("foco no prazo inválido", focoNoPrazo);
      await campo("Prazo").fill(valido.prazo);
      assert.equal(await page.getByText(invalida, { exact: true }).count(), 0);
      assert.equal(await campo("Prazo").getAttribute("aria-invalid"), null);
      await botaoSalvar().click();
      await ate(
        "payload com o prazo corrigido",
        async () => (await payloads()).length === 1,
      );
      assert.deepEqual((await payloads())[0], valido);
      await abrir("editar-prazo-invalido");
      assert.equal(await campo("Prazo").inputValue(), "20265-12-20");
      await botaoSalvar("Atualizar tarefa").click();
      await page.getByText(invalida, { exact: true }).waitFor();
      assert.equal((await payloads()).length, 0);
      await ate("foco no prazo inválido já gravado", focoNoPrazo);
    },
  );
  await conferir("cancelar não envia e a ação é opcional", async () => {
    await abrir("novo");
    await campo("Título").fill("Não deve ser enviada");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__cancelamentos || 0), 1);
    assert.equal((await payloads()).length, 0);
    assert.ok((await resultado()).includes("Cancelado"));
    await abrir("sem-cancelar");
    assert.equal(
      await page.getByRole("button", { name: "Cancelar", exact: true }).count(),
      0,
    );
  });
  await conferir(
    "rejeição do callback preserva valores e reabilita o envio",
    async () => {
      await abrir("erro-salvar");
      await preencher(valido);
      await botaoSalvar().click();
      await ate(
        "callback rejeitado executado",
        async () => (await envios()) === 1,
      );
      assert.equal(await campo("Título").inputValue(), valido.titulo);
      assert.equal(await ui.valor("Descrição"), valido.descricao);
      for (const [rotulo, atributo] of [
        ["Projeto", "projetoId"],
        ["Status", "status"],
        ["Prioridade", "prioridade"],
      ])
        assert.equal(await ui.valor(rotulo), valido[atributo], rotulo);
      assert.equal(await campo("Responsável").inputValue(), valido.responsavel);
      assert.equal(await campo("Prazo").inputValue(), valido.prazo);
      await ate("botão reabilitado", () => botaoEnvio().isEnabled());
    },
  );
  await conferir("envio em curso bloqueia duplicidade", async () => {
    await abrir("lento");
    await preencher(valido);
    await botaoSalvar().click();
    await ate("botão bloqueado durante o envio", () =>
      botaoEnvio().isDisabled(),
    );
    await page.evaluate(() => {
      const f = document.querySelector("form");
      if (f) f.requestSubmit();
    });
    await page.evaluate(() => window.__liberarEnvio());
    await ate("envio concluído", async () =>
      (await resultado()).includes("Concluído"),
    );
    assert.equal(await envios(), 1);
    assert.equal((await payloads()).length, 1);
  });
  await conferir(
    "projetos em carregamento, falha ou vazio bloqueiam o salvar",
    async () => {
      const projetosLentos = await segurar(`${apiUrl}/projetos`);
      await abrir("novo", false);
      await ate("bloqueado enquanto carrega", () => botaoEnvio().isDisabled());
      await projetosLentos.liberar();
      await ate("liberado após carregar", () => botaoEnvio().isEnabled());
      await page.unrouteAll();
      await page.route(`${apiUrl}/projetos`, (route) =>
        route.fulfill({ status: 500, json: {} }),
      );
      await abrir("novo", false);
      await ate("mensagem de falha dos projetos", async () => {
        const texto = await page.locator("body").innerText();
        return (
          /projeto/i.test(texto) &&
          /(não foi possível|erro|falha|indispon)/i.test(texto)
        );
      });
      assert.equal(await botaoEnvio().isDisabled(), true);
      await page.unrouteAll();
      await page.route(`${apiUrl}/projetos`, (route) =>
        route.fulfill({ json: [] }),
      );
      await abrir("novo", false);
      await ate("orientação de lista vazia", async () =>
        /nenhum projeto/i.test(await page.locator("body").innerText()),
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Criar projeto", exact: true })
          .getAttribute("href"),
        "/projetos/novo",
      );
      assert.equal(await botaoEnvio().isDisabled(), true);
      assert.equal((await payloads()).length, 0);
      await page.unrouteAll();
    },
  );
  await conferir(
    "integração real cria tarefa no banco temporário",
    async () => {
      await abrir("criar-real");
      const dados = {
        ...valido,
        titulo: "Tarefa criada pela suíte do formulário",
      };
      await preencher(dados);
      await botaoSalvar().click();
      await ate("confirmação da criação", async () =>
        (await resultado()).startsWith("Criada: "),
      );
      const criada = await ate("tarefa na API", async () => {
        const lista = await (await fetch(`${apiUrl}/tarefas`)).json();
        return lista.find((t) => t.titulo === dados.titulo) || null;
      });
      assert.equal(typeof criada.id, "string");
      assert.deepEqual(
        {
          projetoId: criada.projetoId,
          titulo: criada.titulo,
          descricao: criada.descricao,
          status: criada.status,
          prioridade: criada.prioridade,
          responsavel: criada.responsavel,
          prazo: criada.prazo,
        },
        dados,
      );
      const gravada = await ate(
        "tarefa no arquivo temporário",
        async () =>
          (await lerDb()).tarefas.find((t) => t.id === criada.id) || null,
      );
      assert.equal(gravada.titulo, dados.titulo);
    },
  );
  await conferir(
    "integração real atualiza tarefa existente preservando o id",
    async () => {
      await abrir("editar-real");
      assert.equal(await campo("Título").inputValue(), "Criar o repositório");
      await campo("Título").fill("Repositório atualizado pela suíte");
      await ui.escolher("Status", "Em andamento");
      await botaoSalvar("Atualizar tarefa").click();
      await ate(
        "confirmação da atualização",
        async () => (await resultado()) === "Atualizada: 1",
      );
      const atual = await (await fetch(`${apiUrl}/tarefas/1`)).json();
      assert.equal(atual.id, "1");
      assert.equal(atual.titulo, "Repositório atualizado pela suíte");
      assert.equal(atual.status, "em-andamento");
      assert.equal(atual.projetoId, "1");
      await ate("atualização no arquivo temporário", async () =>
        (await lerDb()).tarefas.some(
          (t) =>
            t.id === "1" && t.titulo === "Repositório atualizado pela suíte",
        ),
      );
    },
  );
  await conferir(
    "projeto inicial isolado e duas instâncias sem conflito de rótulos",
    async () => {
      await abrir("contexto");
      assert.equal(await ui.valor("Projeto"), "2");
      assert.equal(await campo("Título").inputValue(), "");
      await page.goto(`${origem}/?modo=duplo`);
      await ate(
        "duas instâncias",
        async () => (await page.locator("form").count()) === 2,
      );
      await ate(
        "projetos nas duas instâncias",
        async () =>
          (await page
            .locator('form select[name="projetoId"] option[value="1"]')
            .count()) === 2,
      );
      const instancias = [0, 1].map((n) =>
        criarUi(page, () => page.locator("form").nth(n)),
      );
      for (const instancia of instancias) await instancia.abrirDescricao();
      const porInstancia = [
        await associacoes(page, 0),
        await associacoes(page, 1),
      ];
      for (const ligacoes of porInstancia) {
        assert.deepEqual(
          ligacoes.map((l) => l.texto).sort(),
          [...ROTULOS].sort(),
        );
        for (const ligacao of ligacoes) {
          assert.equal(ligacao.controles.length, 1, ligacao.texto);
          if (ligacao.para)
            assert.equal(ligacao.para, ligacao.controles[0].id, ligacao.texto);
        }
      }
      const idsControles = porInstancia.flatMap((ligacoes) =>
        ligacoes.flatMap((l) => [l.id, l.controles[0].id]),
      );
      assert.equal(idsControles.length, 28);
      assert.equal(
        new Set(idsControles).size,
        idsControles.length,
        "rótulos e controles compartilham ids entre instâncias",
      );
      const todosIds = await page
        .locator("[id]")
        .evaluateAll((els) => els.map((el) => el.id).filter(Boolean));
      assert.equal(
        new Set(todosIds).size,
        todosIds.length,
        "ids duplicados na página",
      );
      for (const rotulo of ROTULOS)
        for (const instancia of instancias) {
          assert.equal(
            await (
              ["Projeto", "Status", "Prioridade"].includes(rotulo)
                ? instancia.seletor(rotulo)
                : instancia.campo(rotulo)
            ).count(),
            1,
            rotulo,
          );
        }
      await instancias[0].campo("Título").fill("Somente na primeira");
      assert.equal(await instancias[1].campo("Título").inputValue(), "");
    },
  );

  await conferir(
    "projeto removido da API impede salvar até escolher outro",
    async () => {
      await page.route(`${apiUrl}/projetos`, (route) =>
        route.fulfill({ json: [seed.projetos[0]] }),
      );
      try {
        await abrir("editar", false);
        await page
          .getByText(
            "O projeto desta tarefa não foi encontrado. Escolha um projeto disponível.",
            { exact: true },
          )
          .waitFor();
        const seletor = ui.seletor("Projeto");
        assert.equal(await seletor.getAttribute("aria-invalid"), "true");
        const descricao = await seletor.getAttribute("aria-describedby");
        assert.equal(
          await page.locator(`[id="${descricao}"]`).innerText(),
          "O projeto desta tarefa não foi encontrado. Escolha um projeto disponível.",
        );
        assert.equal(
          await page.locator(`[id="${descricao}"]`).getAttribute("role"),
          "status",
        );
        assert.equal(await botaoEnvio().isDisabled(), true);
        await page.locator("form").evaluate((f) => f.requestSubmit());
        assert.equal((await payloads()).length, 0);
        await ui.escolher("Projeto", seed.projetos[0].nome);
        assert.equal(await ui.valor("Projeto"), "1");
        assert.equal(await seletor.getAttribute("aria-invalid"), null);
        assert.equal(await seletor.getAttribute("aria-describedby"), null);
        await botaoEnvio().click();
        await ate(
          "envio com projeto disponível",
          async () => (await payloads()).length === 1,
        );
        assert.equal((await payloads())[0].projetoId, "1");
      } finally {
        await page.unrouteAll();
      }
    },
  );

  await conferir(
    "tema escuro mesmo com preferência clara e botão legível",
    async () => {
      await page.setViewportSize({ width: 1024, height: 900 });
      const classesTema = () =>
        page.evaluate(() => ({
          dark: document.documentElement.classList.contains("dark"),
          darkMode: document.documentElement.classList.contains("dark-mode"),
        }));
      for (const tema of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme: tema });
        await abrir("editar");
        assert.deepEqual(
          await classesTema(),
          { dark: true, darkMode: true },
          tema,
        );
        await page.waitForFunction(() => document.getAnimations().length === 0);
        const cores = await botaoEnvio().evaluate((el) => ({
          texto: getComputedStyle(el).color,
          fundo: getComputedStyle(el).backgroundColor,
        }));
        assert.ok(
          contraste(cores.texto, cores.fundo) >= 4.5,
          `${tema}: ${cores.texto} sobre ${cores.fundo}`,
        );
        assert.equal(
          await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
          ),
          "rgb(18, 12, 27)",
          tema,
        );
        if (evidencias && tema === "dark")
          await page.screenshot({
            path: join(evidencias, "formulario-escuro.png"),
            fullPage: true,
          });
      }
    },
  );

  await conferir(
    "largura de 320px sem overflow e navegação por teclado",
    async () => {
      await page.setViewportSize({ width: 320, height: 700 });
      await abrir("novo");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.body.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      await page.locator("form label", { hasText: "Responsável" }).click();
      assert.equal(
        await page.evaluate(
          () => document.activeElement && document.activeElement.id,
        ),
        await campo("Responsável").evaluate((el) => el.id),
      );
      assert.equal(await focoVisivel(campo("Responsável")), true);
      let alcancouBotao = false;
      for (let i = 0; i < 8 && !alcancouBotao; i++) {
        await page.keyboard.press("Tab");
        alcancouBotao = await page.evaluate(
          () =>
            document.activeElement instanceof HTMLButtonElement &&
            document.activeElement.closest("form") !== null,
        );
      }
      assert.equal(
        alcancouBotao,
        true,
        "Tab deve alcançar um botão do formulário",
      );
      if (evidencias) {
        await mkdir(evidencias, { recursive: true });
        await page.screenshot({
          path: join(evidencias, "formulario-320.png"),
          fullPage: true,
        });
      }
    },
  );
  await conferir("sem erros de página e bancos reais intactos", async () => {
    assert.deepEqual(errosPagina, []);
    assert.equal(await readFile(join(repo, "db.json"), "utf8"), bancoRealAntes);
    assert.equal(await readFile(join(repo, "db.seed.json"), "utf8"), seedAntes);
  });
  console.log(`${total} cenários aprovados; banco real intacto.`);
}
executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
