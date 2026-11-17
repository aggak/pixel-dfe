const assert = require("node:assert/strict");
const { readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

const raiz = join(__dirname, "..");
let browser;

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const { banco } = await apoio.criarBanco({
    prefixo: ".testes-abas-",
    pasta: raiz,
    semente: "db.json",
  });
  const dados = JSON.parse(await readFile(banco, "utf8"));
  for (let numero = 1; numero <= 12; numero++)
    dados.projetos.push({
      id: `teste-abas-${numero}`,
      nome: `Projeto de teste ${numero}`,
      descricao: "",
      disciplina: "Testes",
      criadoEm: "2026-11-12",
    });
  await writeFile(banco, JSON.stringify(dados));
  const ultimo = dados.projetos.at(-1);
  const { api, web } = await apoio.subirAmbiente({
    banco,
    rotaApi: "/projetos",
  });
  assert.deepEqual(
    (await (await fetch(`${api}/projetos`)).json()).map(
      (projeto) => projeto.id,
    ),
    dados.projetos.map((projeto) => projeto.id),
  );

  browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 375, height: 800 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const abas = page.getByRole("navigation", { name: "Projetos", exact: true });
  const todas = abas.getByRole("link", { name: "Todas", exact: true });
  const setaInicio = abas.locator('button[data-lado="ini"]');
  const setaFim = abas.locator('button[data-lado="fim"]');

  async function abrir(caminho) {
    await page.goto(`${web}${caminho}`);
    await page.waitForFunction(
      (total) => document.querySelectorAll(".e-tabs a").length === total + 1,
      dados.projetos.length,
    );
    await page.evaluate(() => document.fonts.ready);
  }

  async function sobra(esperado) {
    await page.waitForFunction(
      (valor) =>
        document.querySelector<HTMLElement>(".e-tabs")?.dataset.sobra === valor,
      esperado,
    );
    assert.equal(await abas.getAttribute("data-sobra"), esperado);
  }

  async function clicarSeta(seta) {
    const caixa = await seta.boundingBox();
    assert.ok(caixa, "a seta tem uma área visível para o clique");
    await page.mouse.click(
      caixa.x + caixa.width / 2,
      caixa.y + caixa.height / 2,
    );
  }

  async function conferirFaixa() {
    const medida = await abas.evaluate((nav) => {
      const faixa = nav.getBoundingClientRect();
      const fixa = nav.querySelector("a").getBoundingClientRect();
      return {
        transborda: nav.scrollWidth > nav.clientWidth,
        larguraPagina: document.documentElement.scrollWidth,
        larguraTela: document.documentElement.clientWidth,
        inicio: faixa.left,
        fim: faixa.right,
        inicioTodas: fixa.left,
        fimTodas: fixa.right,
        rolagemPagina: window.scrollX,
      };
    });
    assert.equal(medida.transborda, true, "há projetos fora da faixa visível");
    assert.ok(
      medida.larguraPagina <= medida.larguraTela + 1,
      "só as abas podem rolar horizontalmente",
    );
    assert.equal(
      medida.rolagemPagina,
      0,
      "a página não acompanha a rolagem das abas",
    );
    assert.ok(
      medida.inicio >= 0 && medida.fim <= medida.larguraTela + 1,
      "a faixa cabe na tela",
    );
    assert.ok(
      Math.abs(medida.inicioTodas - medida.inicio) <= 1,
      "Todas permanece presa à esquerda",
    );
    assert.ok(
      medida.fimTodas <= medida.fim,
      "Todas permanece inteira dentro da faixa",
    );
  }

  async function conferirAtual() {
    await page.waitForFunction((id) => {
      const nav = document.querySelector(".e-tabs");
      const atual = nav?.querySelector("a[aria-current]");
      if (!atual || atual.getAttribute("href") !== `/projetos/${id}`)
        return false;
      const caixa = atual.getBoundingClientRect();
      return (
        caixa.left >=
          nav.querySelector("a").getBoundingClientRect().right - 1 &&
        caixa.right <= nav.getBoundingClientRect().right + 1
      );
    }, ultimo.id);
    assert.equal(
      await abas
        .getByRole("link", { name: ultimo.nome, exact: true })
        .getAttribute("aria-current"),
      "page",
    );
    assert.ok(
      await abas.evaluate((nav) => nav.scrollLeft > 0),
      "abrir a última aba desloca a faixa",
    );
    await conferirFaixa();
  }

  await abrir("/");
  await sobra("fim");
  assert.equal(await todas.getAttribute("aria-current"), "page");
  assert.equal(await abas.evaluate((nav) => nav.scrollLeft), 0);
  assert.equal(await setaInicio.isVisible(), false);
  assert.equal(await setaFim.isVisible(), false);
  await conferirFaixa();
  console.log(
    "OK: em 375 px, a faixa transborda por dentro, indica fim e mantém Todas à esquerda",
  );

  await abas.hover();
  await page.mouse.wheel(240, 0);
  await sobra("ini fim");
  assert.ok(
    await abas.evaluate((nav) => nav.scrollLeft > 0),
    "o gesto horizontal desloca as abas",
  );
  await conferirFaixa();
  await abas.evaluate((nav) =>
    nav.scrollTo({ left: nav.scrollWidth, behavior: "instant" }),
  );
  await sobra("ini");
  assert.ok(
    await abas.evaluate(
      (nav) =>
        Math.abs(nav.scrollWidth - nav.clientWidth - nav.scrollLeft) <= 1,
    ),
  );
  await conferirFaixa();
  await abas.evaluate((nav) => nav.scrollTo({ left: 0, behavior: "instant" }));
  await sobra("fim");
  await conferirFaixa();
  console.log(
    "OK: início, meio e fim atualizam data-sobra, com Todas fixa durante a rolagem",
  );

  await abrir(`/projetos/${ultimo.id}`);
  await page.getByRole("heading", { name: ultimo.nome, exact: true }).waitFor();
  await conferirAtual();
  await sobra("ini");
  console.log(
    "OK: abrir diretamente o último projeto em 375 px traz a aba ativa inteira para a vista",
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await conferirAtual();
  await sobra("ini");
  assert.equal(await setaInicio.isVisible(), true);
  assert.equal(await setaFim.isVisible(), false);
  console.log(
    "OK: redimensionar preserva a aba ativa visível e atualiza as setas",
  );

  await abrir("/");
  await sobra("fim");
  assert.equal(await setaInicio.isVisible(), false);
  assert.equal(await setaFim.isVisible(), true);
  await clicarSeta(setaFim);
  await sobra("ini fim");
  const depois = await abas.evaluate((nav) => nav.scrollLeft);
  assert.ok(depois > 0, "a seta do fim avança as abas");
  assert.equal(await setaInicio.isVisible(), true);
  assert.equal(await setaFim.isVisible(), true);
  await conferirFaixa();
  await clicarSeta(setaInicio);
  await sobra("fim");
  const retorno = await abas.evaluate((nav) => nav.scrollLeft);
  assert.ok(
    retorno < depois && retorno <= 2,
    `a seta do início retorna ao começo (${depois} → ${retorno} px)`,
  );
  assert.equal(await setaInicio.isVisible(), false);
  await conferirFaixa();
  console.log(
    `OK: em desktop, as duas setas rolam a faixa e somem no limite correspondente (${depois} → ${retorno} px)`,
  );

  async function geometriaFoco() {
    return page.evaluate(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.closest(".e-tabs")) return null;
      const nav = el.closest(".e-tabs") as HTMLElement;
      const todas = nav.querySelector("a");
      const caixa = el.getBoundingClientRect();
      const faixa = nav.getBoundingClientRect();
      const fixa = todas.getBoundingClientRect();
      const movel = matchMedia("(max-width: 650px)").matches;
      const sobra = nav.dataset.sobra || "";
      const recuoIni = sobra.includes("ini") ? (movel ? 20 : 56) : 0;
      const recuoFim = sobra.includes("fim") ? (movel ? 20 : 56) : 0;
      const utilEsq = fixa.right + recuoIni;
      const utilDir = faixa.right - recuoFim;
      return {
        tag: el.tagName,
        nome: el.textContent.trim(),
        todas: el === todas,
        scroll: nav.scrollLeft,
        left: caixa.left,
        right: caixa.right,
        utilEsq,
        utilDir,
        faixaEsq: faixa.left,
        faixaDir: faixa.right,
        cabe: caixa.width <= utilDir - utilEsq + 1,
        paginaX: window.scrollX,
      };
    });
  }

  function afirmarAbaInteira(medida, contexto) {
    assert.ok(medida, `${contexto}: o foco saiu das abas`);
    assert.equal(medida.tag, "A", `${contexto}: o foco não está num link`);
    assert.equal(
      medida.paginaX,
      0,
      `${contexto}: a página rolou na horizontal`,
    );
    if (medida.todas) {
      assert.ok(
        medida.left >= medida.faixaEsq - 1 &&
          medida.right <= medida.faixaDir + 1,
        `${contexto}: Todas fora da faixa`,
      );
      return;
    }
    assert.ok(
      medida.left >= medida.utilEsq - 1,
      `${contexto}: «${medida.nome}» começa em ${medida.left.toFixed(1)} e a área útil em ${medida.utilEsq.toFixed(1)}`,
    );
    if (medida.cabe)
      assert.ok(
        medida.right <= medida.utilDir + 1,
        `${contexto}: «${medida.nome}» termina em ${medida.right.toFixed(1)} e a área útil em ${medida.utilDir.toFixed(1)}`,
      );
  }

  async function conferirFocoTeclado(largura) {
    await page.setViewportSize({ width: largura, height: 800 });
    await abrir("/");
    const haviaCorte = await abas.evaluate((nav) => {
      nav.scrollTo({ left: 0, behavior: "instant" });
      const faixa = nav.getBoundingClientRect();
      return [...nav.querySelectorAll("a")].some(
        (aba, indice) =>
          indice > 0 && aba.getBoundingClientRect().right > faixa.right + 1,
      );
    });
    assert.equal(
      haviaCorte,
      true,
      `${largura}px: o cenário precisa de uma aba cortada no começo da faixa`,
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    const ida = [];
    for (let passo = 0; passo < 40; passo++) {
      await page.keyboard.press("Tab");
      const medida = await geometriaFoco();
      if (!medida) {
        if (ida.length) break;
        continue;
      }
      afirmarAbaInteira(medida, `Tab ${largura}px`);
      ida.push(medida);
    }
    assert.ok(ida.length >= 8, `${largura}px: só ${ida.length} abas no Tab`);
    assert.equal(
      ida[0].todas,
      true,
      `${largura}px: a primeira aba do percurso é Todas`,
    );
    assert.ok(
      ida.some((medida) => medida.scroll > 1),
      `${largura}px: focar a aba cortada não rolou a faixa`,
    );
    const volta = [];
    for (let passo = 0; passo < ida.length; passo++) {
      await page.keyboard.press("Shift+Tab");
      const medida = await geometriaFoco();
      if (!medida) break;
      afirmarAbaInteira(medida, `Shift+Tab ${largura}px`);
      volta.push(medida);
    }
    assert.equal(
      volta.length,
      ida.length,
      `${largura}px: o Shift+Tab não refez as abas`,
    );
    console.log(
      `OK: em ${largura}px, Tab e Shift+Tab deixam cada aba focada inteira na área útil`,
    );
  }

  await conferirFocoTeclado(320);
  await conferirFocoTeclado(1280);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 320, height: 800 });
  await abrir("/");
  await abas.evaluate((nav) => {
    const vistos = [];
    const nativo = HTMLElement.prototype.scrollTo;
    nav.scrollTo = function (opcoes) {
      if (opcoes && typeof opcoes === "object") vistos.push(opcoes.behavior);
      return nativo.call(this, opcoes);
    };
    nav.__vistos = vistos;
  });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  let rolouSuave = false;
  for (let passo = 0; passo < 24 && !rolouSuave; passo++) {
    await page.keyboard.press("Tab");
    rolouSuave = await abas.evaluate((nav) => nav.__vistos.includes("smooth"));
  }
  assert.equal(
    rolouSuave,
    true,
    "sem movimento reduzido, focar a aba cortada rola a faixa com suavidade",
  );
  await page.waitForFunction(() => {
    const el = document.activeElement;
    const nav = el?.closest?.(".e-tabs") as HTMLElement;
    if (!nav || el === nav.querySelector("a")) return false;
    const caixa = el.getBoundingClientRect();
    const faixa = nav.getBoundingClientRect();
    const fixa = nav.querySelector("a").getBoundingClientRect();
    const sobra = nav.dataset.sobra || "";
    const utilEsq = fixa.right + (sobra.includes("ini") ? 20 : 0);
    const utilDir = faixa.right - (sobra.includes("fim") ? 20 : 0);
    return (
      caixa.left >= utilEsq - 1 &&
      (caixa.width > utilDir - utilEsq + 1 || caixa.right <= utilDir + 1)
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await abas.evaluate((nav) => {
    nav.scrollTo({ left: 0, behavior: "instant" });
    nav.__vistos.length = 0;
  });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  let rolouNaHora = false;
  for (let passo = 0; passo < 24 && !rolouNaHora; passo++) {
    await page.keyboard.press("Tab");
    rolouNaHora = await abas.evaluate(
      (nav) =>
        nav.__vistos.includes("auto") && !nav.__vistos.includes("smooth"),
    );
  }
  assert.equal(
    rolouNaHora,
    true,
    "com movimento reduzido, a faixa rola na hora, sem suavidade",
  );
  await abas.evaluate((nav) => {
    delete nav.scrollTo;
    delete nav.__vistos;
  });
  console.log(
    "OK: a rolagem do foco é suave só quando o movimento reduzido está desligado",
  );

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(
    await readFile(join(raiz, "db.seed.json"), "utf8"),
    seedOriginal,
  );
  console.log("OK: sem erros JavaScript e bancos locais preservados");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
