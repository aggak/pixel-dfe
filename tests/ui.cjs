// Apoio compartilhado das suítes de navegador: localizadores da interface atual
// (React Aria + ficha modal) sem alterar o contrato de negócio de cada teste.
const { chromium } = require("playwright");

const CONTROLES_SELECT = { Projeto: "projetoId", Status: "status", Prioridade: "prioridade" };
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lancarNavegador() {
  return chromium.launch({ channel: process.env.TEST_BROWSER || "chrome", headless: true });
}

// `escopo` devolve o formulário alvo (o primeiro por padrão; use outro índice com mais de uma instância).
function criarUi(page, escopo = () => page.locator("form").first()) {
  // O rótulo acessível termina com o asterisco de obrigatório: "Nome*".
  const campo = (nome) => escopo().getByLabel(new RegExp(`^${escapar(nome)}\\s*\\*?$`));
  // Select real: o botão visível é o que recebe clique; o <select> oculto só é lido para conferir o contrato.
  const seletor = (nome) => escopo().getByRole("button", { name: new RegExp(`(?:^|\\s)${escapar(nome)}\\s*\\*?$`) });
  const oculto = (nome) => escopo().locator(`select[name="${CONTROLES_SELECT[nome]}"]`);
  const alternarDescricao = () => escopo().locator("button.e-description-toggle");

  // Obrigatoriedade exposta ao usuário: aria-required no campo ou data-required no select, mais o asterisco do rótulo.
  async function obrigatorio(nome) {
    if (CONTROLES_SELECT[nome]) {
      const raiz = seletor(nome).locator("xpath=..");
      return (await raiz.getAttribute("data-required")) === "true" && /\*/.test(await raiz.locator("[data-label]").innerText());
    }
    const rotulo = escopo().locator("label", { hasText: nome });
    return (await campo(nome).getAttribute("aria-required")) === "true" && /\*/.test(await rotulo.first().innerText());
  }
  async function escolher(nome, texto) {
    await seletor(nome).click();
    const opcao = page.getByRole("option", { name: texto, exact: true });
    await opcao.click();
    await opcao.waitFor({ state: "detached" });
  }
  async function abrirDescricao() {
    const alternador = alternarDescricao();
    if ((await alternador.getAttribute("aria-expanded")) === "false") await alternador.click();
    await campo("Descrição").waitFor();
  }
  async function fecharDescricao() {
    const alternador = alternarDescricao();
    if ((await alternador.getAttribute("aria-expanded")) === "true") await alternador.click();
    await campo("Descrição").waitFor({ state: "detached" });
  }
  // Valor de qualquer um dos sete campos; a descrição é aberta antes de ser lida.
  async function valor(nome) {
    if (CONTROLES_SELECT[nome]) return oculto(nome).inputValue();
    if (nome === "Descrição") await abrirDescricao();
    return campo(nome).inputValue();
  }
  const opcoes = (nome) => oculto(nome).evaluate((el) => [...el.options].filter((o) => o.value).map((o) => ({ value: o.value, texto: (o.textContent || "").trim() })));
  async function projetosCarregados(minimo) {
    return (await opcoes("Projeto")).length >= minimo && (await seletor("Projeto").isEnabled());
  }
  async function preencherTarefa(dados) {
    if (dados.projetoId) await escolher("Projeto", dados.nomeProjeto);
    await campo("Título").fill(dados.titulo);
    await abrirDescricao();
    await campo("Descrição").fill(dados.descricao);
    await escolher("Status", dados.nomeStatus);
    await escolher("Prioridade", dados.nomePrioridade);
    await campo("Responsável").fill(dados.responsavel);
    await campo("Prazo").fill(dados.prazo);
  }
  return { campo, seletor, obrigatorio, oculto, alternarDescricao, escolher, abrirDescricao, fecharDescricao, valor, opcoes, projetosCarregados, preencherTarefa };
}

// Rótulos de um formulário e os controles que apontam para eles (aria-labelledby), um por rótulo.
function associacoes(page, indice = 0) {
  return page.evaluate((i) => {
    const form = document.querySelectorAll("form")[i];
    return [...form.querySelectorAll("[data-label]")].map((rotulo) => ({
      texto: [...rotulo.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(),
      id: rotulo.id,
      para: rotulo.getAttribute("for"),
      controles: [...form.querySelectorAll("[aria-labelledby]")]
        .filter((c) => c.getAttribute("aria-labelledby").split(/\s+/).includes(rotulo.id))
        .map((c) => ({ tag: c.tagName, id: c.id })),
    }));
  }, indice);
}

const TEXTO_STATUS = { "a-fazer": "A fazer", "em-andamento": "Em andamento", "em-revisao": "Em revisão", concluida: "Concluída" };
const TEXTO_PRIORIDADE = { baixa: "Baixa", media: "Média", alta: "Alta" };

// Acrescenta os textos exibidos nas opções ao payload de negócio (nome do projeto vem do banco).
function comTextos(dados, projetos) {
  return {
    ...dados,
    nomeProjeto: projetos.find((p) => String(p.id) === String(dados.projetoId))?.nome,
    nomeStatus: TEXTO_STATUS[dados.status],
    nomePrioridade: TEXTO_PRIORIDADE[dados.prioridade],
  };
}

// Foco visível: contorno do controle ou anel desenhado pelo envoltório do campo.
async function focoVisivel(locator) {
  return locator.evaluate((el) => {
    const proprio = getComputedStyle(el);
    if (proprio.outlineStyle !== "none" && parseFloat(proprio.outlineWidth) > 0 && !/rgba\(0, 0, 0, 0\)/.test(proprio.outlineColor)) return true;
    const envoltorio = el.closest("[data-focus-within], [data-focus-visible]");
    return Boolean(envoltorio && getComputedStyle(envoltorio).boxShadow !== "none");
  });
}

function luminancia(rgb) {
  return rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((n) => n / 255).map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)).reduce((soma, n, i) => soma + n * [0.2126, 0.7152, 0.0722][i], 0);
}
function contraste(a, b) {
  const [menor, maior] = [luminancia(a), luminancia(b)].sort((x, y) => x - y);
  return (maior + 0.05) / (menor + 0.05);
}

module.exports = { associacoes, lancarNavegador, criarUi, comTextos, focoVisivel, contraste, escapar, TEXTO_STATUS, TEXTO_PRIORIDADE };
