const assert = require("node:assert/strict");
const { criarApoio } = require("./apoio.cts");

const apoio = criarApoio();

async function executar() {
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-folha-inferior-" });
  const { web } = await apoio.subirAmbiente({ banco });
  const browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 375, height: 667 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(10000);
  await page.route("**/*", (rota) => {
    const url = new URL(rota.request().url());
    return url.hostname === "127.0.0.1" ? rota.continue() : rota.abort();
  });

  const ficha = page.locator(".e-form-modal");
  const cabecalho = page.locator(".e-form-header");
  const medir = () =>
    page.evaluate(() => {
      const caixa = document
        .querySelector(".e-form-modal")
        .getBoundingClientRect();
      return {
        esquerda: caixa.left,
        direita: caixa.right,
        topo: caixa.top,
        base: caixa.bottom,
        largura: document.documentElement.clientWidth,
        altura: window.innerHeight,
      };
    });
  async function presaEmbaixo() {
    const caixa = await medir();
    assert.equal(caixa.esquerda, 0);
    assert.equal(caixa.direita, caixa.largura);
    assert.ok(Math.abs(caixa.base - caixa.altura) < 1);
    assert.ok(caixa.topo >= 12);
    return caixa;
  }
  async function semAlca() {
    for (const atributo of ["tabindex", "aria-label", "title"])
      assert.equal(await cabecalho.getAttribute(atributo), null);
    const antes = await ficha.boundingBox();
    const alvo = await cabecalho.boundingBox();
    await page.mouse.move(alvo.x + 80, alvo.y + 16);
    await page.mouse.down();
    await page.mouse.move(alvo.x + 20, alvo.y - 120, { steps: 6 });
    await page.mouse.up();
    assert.deepEqual(await ficha.boundingBox(), antes);
    assert.equal(await cabecalho.getAttribute("data-arrastando"), null);
  }

  // Em pé: ler abre numa folha presa embaixo, com a página aparecendo em cima.
  await page.goto(web, { waitUntil: "domcontentloaded" });
  const titulo = page.locator(".e-task-title").first();
  await titulo.waitFor();
  const nomeTarefa = (await titulo.textContent()).trim();
  await titulo.click();
  await page.locator(".e-read-edit").waitFor();
  assert.ok(await ficha.evaluate((no) => no.matches(".e-folha")));
  const leitura = await presaEmbaixo();
  await page.waitForFunction(() =>
    document.activeElement?.matches(".e-form-header button"),
  );
  await semAlca();
  assert.equal(
    await ficha.evaluate((no) => getComputedStyle(no).animationDuration),
    "0s",
  );
  for (const acao of [".e-read-edit", ".e-read-delete"]) {
    const caixa = await page.locator(acao).boundingBox();
    assert.ok(caixa.height >= 44 && caixa.y + caixa.height <= leitura.altura);
  }
  console.log("OK: leitura em pé presa à borda de baixo, sem alça");

  // Editar continua na mesma folha, com as ações à vista.
  await page.locator(".e-read-edit").click();
  const salvar = page.getByRole("button", { name: "Salvar alterações" });
  await salvar.waitFor();
  const edicao = await presaEmbaixo();
  await semAlca();
  const botao = await salvar.boundingBox();
  assert.ok(botao.y + botao.height <= edicao.altura);
  console.log("OK: edição em pé na folha, ações visíveis");

  // Deitado: a folha vale pela altura, mesmo com a tela larga.
  await page.setViewportSize({ width: 740, height: 360 });
  await presaEmbaixo();
  await semAlca();
  const deitado = await salvar.boundingBox();
  assert.ok(deitado.y + deitado.height <= 360);
  console.log("OK: edição deitada na folha, ações visíveis");

  // Tela larga: a ficha volta a ser movida pelo cabeçalho; ao estreitar de
  // novo, o deslocamento não acompanha a folha.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(
    () =>
      document.querySelector(".e-form-header").getAttribute("aria-label") ===
      "Mover ficha",
  );
  assert.equal(await cabecalho.getAttribute("tabindex"), "0");
  const solta = await ficha.boundingBox();
  await cabecalho.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  assert.ok(Math.abs((await ficha.boundingBox()).x - solta.x + 40) < 2);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForFunction(
    () => !document.querySelector(".e-form-header").hasAttribute("tabindex"),
  );
  await presaEmbaixo();
  assert.ok(
    await page.evaluate(() =>
      document.activeElement?.matches(".e-form-header button"),
    ),
  );
  await page.keyboard.press("ArrowLeft");
  await presaEmbaixo();
  console.log("OK: alça volta na tela larga e some de novo no celular");

  // Áreas seguras: o env() do navegador de teste é zero, então o teste
  // escreve as variáveis que a folha lê dele. Celular estreito em pé e
  // celular largo deitado, na edição e na leitura.
  const SEGURA = { cima: 47, baixo: 34, esquerda: 47, direita: 47 };
  async function dentroDaAreaSegura(acoes) {
    await ficha.evaluate((no, segura) => {
      for (const [lado, px] of Object.entries(segura))
        no.style.setProperty(`--folha-segura-${lado}`, `${px}px`);
    }, SEGURA);
    const caixa = await presaEmbaixo();
    assert.ok(caixa.topo >= SEGURA.cima);
    for (const acao of acoes) {
      const botao = await acao.boundingBox();
      assert.ok(botao.x >= SEGURA.esquerda);
      assert.ok(botao.x + botao.width <= caixa.largura - SEGURA.direita);
      assert.ok(botao.y + botao.height <= caixa.altura - SEGURA.baixo);
      assert.ok(botao.y >= caixa.topo);
    }
    await ficha.evaluate((no, segura) => {
      for (const lado of Object.keys(segura))
        no.style.removeProperty(`--folha-segura-${lado}`);
    }, SEGURA);
  }
  const TELAS = [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ];
  const cancelar = page.getByRole("button", { name: "Cancelar" });
  for (const tela of TELAS) {
    await page.setViewportSize(tela);
    await dentroDaAreaSegura([salvar, cancelar]);
  }
  await cancelar.click();
  await page.locator(".e-read-edit").waitFor();
  for (const tela of TELAS) {
    await page.setViewportSize(tela);
    await dentroDaAreaSegura([
      page.locator(".e-read-edit"),
      page.locator(".e-read-delete"),
    ]);
  }
  console.log("OK: ações dentro da área segura em 320 e 844 px");

  // Teto da leitura em pé: com descrição longa, a folha para em 76% da
  // altura, a descrição rola por dentro e as ações continuam à vista. O
  // teto vale para o conteúdo de leitura (.fol); a edição vai além dele.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => {
    document.querySelector(".e-read-description").textContent =
      "Linha longa de descrição. ".repeat(120);
  });
  const cheia = await presaEmbaixo();
  assert.ok(Math.abs(cheia.altura - cheia.topo - 0.76 * 667) < 1);
  const editar = await page.locator(".e-read-edit").boundingBox();
  assert.ok(editar.y >= cheia.topo && editar.y + editar.height <= 667);
  assert.ok(
    await page
      .locator(".e-panel-scroll")
      .evaluate((no) => no.scrollHeight > no.clientHeight),
  );
  await page.locator(".e-read-edit").click();
  await salvar.waitFor();
  // Com menos altura disponível, o editor pode usar mais espaço que a leitura.
  await page.setViewportSize({ width: 375, height: 400 });
  const formulario = await presaEmbaixo();
  assert.ok(formulario.altura - formulario.topo > 0.76 * formulario.altura);
  await page.setViewportSize({ width: 375, height: 667 });
  await cancelar.click();
  await page.locator(".e-read-edit").waitFor();
  console.log("OK: leitura para em 76% da altura e a edição passa dele");

  // Fechar devolve o foco a quem abriu a ficha.
  await page.keyboard.press("Escape");
  await ficha.waitFor({ state: "detached" });
  await page.waitForFunction(
    (nome) =>
      document.activeElement?.matches(".e-task-title") &&
      document.activeElement.textContent.trim() === nome,
    nomeTarefa,
  );
  console.log("OK: foco volta ao título da tarefa ao fechar");

  // Nova tarefa e projetos não usam a folha inferior.
  for (const rota of ["/tarefas/nova", "/projetos/novo"]) {
    await page.goto(web + rota, { waitUntil: "domcontentloaded" });
    await page.locator("form").waitFor();
    assert.ok(await ficha.evaluate((no) => !no.matches(".e-folha")));
    assert.equal(await cabecalho.getAttribute("aria-label"), "Mover ficha");
    const caixa = await medir();
    assert.ok(caixa.esquerda > 0 && caixa.direita < caixa.largura);
  }
  console.log("OK: nova tarefa e novo projeto ficam fora da folha inferior");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
