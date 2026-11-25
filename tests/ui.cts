const { chromium } = require("playwright");

const CONTROLES_SELECT = {
  Projeto: "projetoId",
  Status: "status",
  Prioridade: "prioridade",
};
const DIALOGOS_DATA = {
  Prazo: "Selecionar prazo",
  "Criado em": "Selecionar data de criação",
};
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lancarNavegador() {
  return chromium.launch({
    channel: process.env.TEST_BROWSER || "chrome",
    headless: true,
  });
}

function criarUi(page, escopo = () => page.locator("form").first()) {
  const campo = (nome) =>
    escopo().getByLabel(
      new RegExp(`^${escapar(nome)}(?:\\s*opcional)?\\s*\\*?$`),
    );
  const seletor = (nome) =>
    escopo().getByRole("button", {
      name: new RegExp(`(?:^|\\s)${escapar(nome)}\\s*\\*?$`),
    });
  const oculto = (nome) =>
    escopo().locator(`select[name="${CONTROLES_SELECT[nome]}"]`);
  const alternarDescricao = () =>
    escopo().locator("button.e-description-toggle");
  const atalhoData = (rotulo) =>
    escopo().locator(`button[data-prazo-atalho][aria-label^="${rotulo}"]`);
  const painelData = (rotulo) =>
    page.getByRole("dialog", { name: DIALOGOS_DATA[rotulo] });

  async function abrirData(rotulo) {
    if (!(await atalhoData(rotulo).count())) return campo(rotulo);
    if (!(await painelData(rotulo).isVisible()))
      await atalhoData(rotulo).click();
    return painelData(rotulo).getByLabel(
      new RegExp(`^${escapar(rotulo)}\\s*\\*?$`),
    );
  }

  async function fecharData(rotulo) {
    if (!(await painelData(rotulo).isVisible())) return;
    await page.keyboard.press("Escape");
    await painelData(rotulo).waitFor({ state: "hidden" });
  }

  async function preencherData(rotulo, valor) {
    await (await abrirData(rotulo)).fill(valor);
    await fecharData(rotulo);
  }

  const atalhoPrazo = () => atalhoData("Prazo");
  const abrirPrazo = () => abrirData("Prazo");
  const fecharPrazo = () => fecharData("Prazo");
  const preencherPrazo = (valor) => preencherData("Prazo", valor);

  async function obrigatorio(nome) {
    if (DIALOGOS_DATA[nome] && (await atalhoData(nome).count())) {
      const entrada = await abrirData(nome);
      const rotulo = painelData(nome).locator("label", { hasText: nome });
      const resultado =
        (await entrada.getAttribute("aria-required")) === "true" &&
        /\*/.test(await rotulo.first().innerText());
      await fecharData(nome);
      return resultado;
    }
    if (CONTROLES_SELECT[nome]) {
      const raiz = seletor(nome).locator("xpath=..");
      return (
        (await raiz.getAttribute("data-required")) === "true" &&
        /\*/.test(await raiz.locator("[data-label]").innerText())
      );
    }
    const rotulo = escopo().locator("label", { hasText: nome });
    return (
      (await campo(nome).getAttribute("aria-required")) === "true" &&
      /\*/.test(await rotulo.first().innerText())
    );
  }
  async function escolher(nome, texto) {
    await seletor(nome).click();
    const opcao = page.getByRole("option", { name: texto, exact: true });
    await opcao.click();
    await opcao.waitFor({ state: "detached" });
  }
  async function abrirDescricao() {
    const alternador = alternarDescricao();
    if ((await alternador.getAttribute("aria-expanded")) === "false")
      await alternador.click();
    await campo("Descrição").waitFor();
  }
  async function fecharDescricao() {
    const alternador = alternarDescricao();
    if ((await alternador.getAttribute("aria-expanded")) === "true")
      await alternador.click();
    await campo("Descrição").waitFor({ state: "detached" });
  }
  async function valor(nome) {
    if (CONTROLES_SELECT[nome]) return oculto(nome).inputValue();
    if (nome === "Descrição") await abrirDescricao();
    if (DIALOGOS_DATA[nome]) {
      const entrada = await abrirData(nome);
      const valorData = await entrada.inputValue();
      await fecharData(nome);
      return valorData;
    }
    return campo(nome).inputValue();
  }
  const opcoes = (nome) =>
    oculto(nome).evaluate((el) =>
      [...el.options]
        .filter((o) => o.value)
        .map((o) => ({ value: o.value, texto: (o.textContent || "").trim() })),
    );
  async function projetosCarregados(minimo) {
    return (
      (await opcoes("Projeto")).length >= minimo &&
      (await seletor("Projeto").isEnabled())
    );
  }
  async function preencherTarefa(dados) {
    if (dados.projetoId) await escolher("Projeto", dados.nomeProjeto);
    await campo("Título").fill(dados.titulo);
    await abrirDescricao();
    await campo("Descrição").fill(dados.descricao);
    await escolher("Status", dados.nomeStatus);
    await escolher("Prioridade", dados.nomePrioridade);
    await campo("Responsável").fill(dados.responsavel);
    await preencherPrazo(dados.prazo);
  }
  return {
    campo,
    seletor,
    obrigatorio,
    oculto,
    alternarDescricao,
    atalhoData,
    painelData,
    abrirData,
    fecharData,
    preencherData,
    atalhoPrazo,
    abrirPrazo,
    fecharPrazo,
    preencherPrazo,
    escolher,
    abrirDescricao,
    fecharDescricao,
    valor,
    opcoes,
    projetosCarregados,
    preencherTarefa,
  };
}

function associacoes(page, indice = 0) {
  return page.evaluate((i) => {
    const form = document.querySelectorAll("form")[i];
    return [...form.querySelectorAll("[data-label]")].map((rotulo) => ({
      texto: [...rotulo.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join("")
        .trim(),
      id: rotulo.id,
      para: rotulo.getAttribute("for"),
      controles: [...form.querySelectorAll("[aria-labelledby]")]
        .filter((c) =>
          c.getAttribute("aria-labelledby").split(/\s+/).includes(rotulo.id),
        )
        .map((c) => ({ tag: c.tagName, id: c.id })),
    }));
  }, indice);
}

const TEXTO_STATUS = {
  "a-fazer": "A fazer",
  "em-andamento": "Em andamento",
  "em-revisao": "Em revisão",
  concluida: "Concluída",
};
const TEXTO_PRIORIDADE = { baixa: "Baixa", media: "Média", alta: "Alta" };

function comTextos(dados, projetos) {
  return {
    ...dados,
    nomeProjeto: projetos.find((p) => String(p.id) === String(dados.projetoId))
      ?.nome,
    nomeStatus: TEXTO_STATUS[dados.status],
    nomePrioridade: TEXTO_PRIORIDADE[dados.prioridade],
  };
}

function comandoProjetos(page) {
  const nav = page.getByRole("navigation", { name: "Projetos", exact: true });
  const todas = nav.getByRole("link", { name: "Todas", exact: true });
  const gatilho = nav.locator('[data-action="project-command"]');
  const dialogo = page.getByRole("dialog", {
    name: /^(Ir para projeto|Trocar projeto)$/,
  });
  const busca = dialogo.getByLabel("Buscar projeto", { exact: true });
  const lista = dialogo.getByRole("listbox", {
    name: "Projetos",
    exact: true,
  });
  const opcoes = lista.getByRole("option");
  const opcao = (nome) =>
    lista.getByRole("option", { name: nome, exact: true });

  async function abrir() {
    await gatilho.click();
    await busca.waitFor();
  }
  async function ir(nome) {
    await abrir();
    await opcao(nome).click();
    await dialogo.waitFor({ state: "detached" });
  }
  return {
    nav,
    todas,
    gatilho,
    dialogo,
    busca,
    lista,
    opcoes,
    opcao,
    abrir,
    ir,
  };
}

async function focoVisivel(locator) {
  return locator.evaluate((el) => {
    const proprio = getComputedStyle(el);
    if (
      proprio.outlineStyle !== "none" &&
      parseFloat(proprio.outlineWidth) > 0 &&
      !/rgba\(0, 0, 0, 0\)/.test(proprio.outlineColor)
    )
      return true;
    const envoltorio = el.closest("[data-focus-within], [data-focus-visible]");
    return Boolean(
      envoltorio && getComputedStyle(envoltorio).boxShadow !== "none",
    );
  });
}

function luminancia(rgb) {
  return rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((soma, n, i) => soma + n * [0.2126, 0.7152, 0.0722][i], 0);
}
function contraste(a, b) {
  const [menor, maior] = [luminancia(a), luminancia(b)].sort((x, y) => x - y);
  return (maior + 0.05) / (menor + 0.05);
}

function criarEsperas(page) {
  let marcas = 0;
  async function assentar() {
    const marca = new URL(`/__assentar-${++marcas}`, page.url()).href;
    const registrada = page.waitForRequest(marca);
    await page.evaluate(
      (url) =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setTimeout(() => {
                fetch(url).catch(() => {});
                resolve();
              }),
            ),
          ),
        ),
      marca,
    );
    await registrada;
  }
  async function segurar(
    url,
    { metodo, responder = (rota) => rota.continue() }: any = {},
  ) {
    let soltar;
    const solta = new Promise((resolve) => {
      soltar = resolve;
    });
    const pedidos = [];
    const entregas = [];
    await page.route(url, (rota) => {
      if (metodo && rota.request().method() !== metodo)
        return rota.continue().catch(() => {});
      pedidos.push(rota.request());
      entregas.push(solta.then(() => responder(rota)).catch(() => {}));
    });
    async function liberar() {
      soltar();
      await Promise.all(entregas);
      await Promise.all(
        pedidos.map(async (pedido) => {
          const resposta = await pedido.response().catch(() => null);
          await resposta?.finished().catch(() => {});
        }),
      );
      await assentar();
    }
    return { pedidos, liberar };
  }
  return { assentar, segurar };
}

module.exports = {
  associacoes,
  lancarNavegador,
  comandoProjetos,
  criarUi,
  criarEsperas,
  comTextos,
  focoVisivel,
  contraste,
  escapar,
  TEXTO_STATUS,
  TEXTO_PRIORIDADE,
};
