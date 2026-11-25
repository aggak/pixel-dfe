const assert = require("node:assert/strict");
const { readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

const { criarApoio } = require("./apoio.cts");
const { comandoProjetos, focoVisivel } = require("./ui.cts");
const apoio = criarApoio();

const raiz = join(__dirname, "..");
const SISTEMAS = [
  { nome: "Linux", plataforma: "Linux x86_64", agente: "X11; Linux x86_64" },
  {
    nome: "Windows",
    plataforma: "Win32",
    agente: "Windows NT 10.0; Win64; x64",
  },
  {
    nome: "macOS",
    plataforma: "MacIntel",
    agente: "Macintosh; Intel Mac OS X 10_15_7",
  },
];
let browser;

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-comando-" });
  const dados = JSON.parse(await readFile(banco, "utf8"));
  const acentuado = "Revisão de Produção Ágil";
  const longo =
    "Projeto de nome muito comprido para conferir a quebra de linha na lista do comando";
  const extras = [
    acentuado,
    ...Array.from(
      { length: 20 },
      (_, indice) => `Projeto de teste ${indice + 1}`,
    ),
    longo,
  ];
  extras.forEach((nome, indice) =>
    dados.projetos.push({
      id: `teste-comando-${indice}`,
      nome,
      descricao: "",
      disciplina: "Testes",
      criadoEm: "2026-11-12",
    }),
  );
  await writeFile(banco, JSON.stringify(dados));
  const nomes = dados.projetos.map((projeto) => projeto.nome);
  const primeiro = dados.projetos[0];
  const ultimo = dados.projetos.at(-1);
  const { api, web } = await apoio.subirAmbiente({
    banco,
    rotaApi: "/projetos",
  });

  browser = await apoio.abrirNavegador();
  const errosPagina = [];

  async function novaPagina(sistema = SISTEMAS[0], opcoes = {}) {
    const contexto = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
      userAgent: `Mozilla/5.0 (${sistema.agente}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36`,
      ...opcoes,
    });
    await contexto.addInitScript((plataforma) => {
      Object.defineProperty(Navigator.prototype, "platform", {
        get: () => plataforma,
      });
      Object.defineProperty(Navigator.prototype, "userAgentData", {
        get: () => undefined,
      });
    }, sistema.plataforma);
    const page = await contexto.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (erro) => errosPagina.push(erro.message));
    return { contexto, page, comando: comandoProjetos(page) };
  }

  const { contexto, page, comando } = await novaPagina();
  const caminho = () => new URL(page.url()).pathname;

  async function abrirRota(rota) {
    await page.goto(`${web}${rota}`);
    await comando.gatilho.waitFor();
    await page.evaluate(() => document.fonts.ready);
  }

  async function fechado() {
    await comando.dialogo.waitFor({ state: "detached" });
  }

  async function esperarFoco(locator, mensagem) {
    const elemento = await locator.elementHandle();
    await page
      .waitForFunction((el) => el === document.activeElement, elemento)
      .catch(() => assert.fail(mensagem));
  }

  async function destacada() {
    const id = await comando.busca.getAttribute("aria-activedescendant");
    if (!id) return null;
    return page.locator(`[id="${id}"]`).getAttribute("aria-label");
  }

  async function esperarDestacada(nome) {
    await page
      .waitForFunction((esperado) => {
        const id = document.activeElement?.getAttribute(
          "aria-activedescendant",
        );
        const opcao = id ? document.getElementById(id) : null;
        return opcao?.getAttribute("aria-label") === esperado;
      }, nome)
      .catch(async () => assert.equal(await destacada(), nome));
  }

  async function marcarSemRecarga() {
    await page.evaluate(() => {
      window.semRecarga = true;
    });
  }

  async function conferirSemRecarga() {
    assert.equal(
      await page.evaluate(() => window.semRecarga),
      true,
      "a troca de projeto não recarrega a página",
    );
  }

  async function conferirCabecalho(contextoTeste) {
    const medida = await comando.nav.evaluate((nav) => {
      const faixa = nav.getBoundingClientRect();
      return {
        classe: nav.classList.contains("e-projetos-comando"),
        links: nav.querySelectorAll("a").length,
        pagina: document.documentElement.scrollWidth,
        tela: document.documentElement.clientWidth,
        transborda: nav.scrollWidth > nav.clientWidth + 1,
        cabem: [...nav.querySelectorAll("a, button")].every((el) => {
          const caixa = el.getBoundingClientRect();
          return (
            caixa.width > 0 &&
            caixa.left >= faixa.left - 8 &&
            caixa.right <= faixa.right + 1
          );
        }),
      };
    });
    assert.equal(medida.classe, true, contextoTeste);
    assert.equal(medida.links, 1, `${contextoTeste}: só Todas fica exposto`);
    assert.ok(
      medida.pagina <= medida.tela + 1,
      `${contextoTeste}: a página não rola na horizontal`,
    );
    assert.equal(
      medida.transborda,
      false,
      `${contextoTeste}: a barra não transborda`,
    );
    assert.equal(medida.cabem, true, `${contextoTeste}: controles inteiros`);
  }

  async function conferirListaLonga(contextoTeste) {
    await comando.abrir();
    assert.equal(await comando.opcoes.count(), nomes.length + 1);
    const medida = await comando.dialogo.evaluate((dialogo) => {
      const caixa = dialogo.getBoundingClientRect();
      const lista = dialogo.querySelector("[role=listbox]");
      return {
        dentro:
          caixa.left >= 0 &&
          caixa.right <= innerWidth + 1 &&
          caixa.top >= 0 &&
          caixa.bottom <= innerHeight + 1,
        rola: lista.scrollHeight > lista.clientHeight,
        semLargura: lista.scrollWidth <= lista.clientWidth + 1,
      };
    });
    assert.deepEqual(
      medida,
      { dentro: true, rola: true, semLargura: true },
      `${contextoTeste}: o diálogo cabe e só a lista rola`,
    );
    for (const nome of ["Todas (atual)", ...nomes]) {
      await page.keyboard.press("ArrowDown");
      await esperarDestacada(nome);
    }
    await page.waitForFunction(() => {
      const id = document.activeElement?.getAttribute("aria-activedescendant");
      const opcao = id ? document.getElementById(id) : null;
      const lista = opcao?.closest("[role=listbox]");
      if (!lista) return false;
      const caixa = opcao.getBoundingClientRect();
      const area = lista.getBoundingClientRect();
      return caixa.top >= area.top - 1 && caixa.bottom <= area.bottom + 1;
    });
    await page.keyboard.press("Escape");
    await fechado();
  }

  await abrirRota("/");
  assert.equal(await comando.todas.getAttribute("aria-current"), "page");
  assert.equal(
    await page.getByRole("button", { name: "Ir para projeto" }).count(),
    1,
  );
  assert.deepEqual(errosPagina, []);
  for (const largura of [1280, 375, 320]) {
    await page.setViewportSize({ width: largura, height: 800 });
    await conferirCabecalho(`${largura}px sem projeto atual`);
    await conferirListaLonga(`${largura}px`);
  }
  console.log(
    "OK: a barra mostra só Todas e o comando; a lista longa cabe em 1280, 375 e 320 px e rola por dentro",
  );

  const tarefaEmFoco = page.locator("[data-task-id] .e-task-title").last();
  await tarefaEmFoco.focus();
  await page.keyboard.press("Alt+KeyP");
  await comando.busca.waitFor();
  await page.keyboard.press("Escape");
  await fechado();
  await esperarFoco(tarefaEmFoco, "Escape devolve o foco à tarefa após Alt+P");

  await abrirRota(`/projetos/${ultimo.id}`);
  await page.getByRole("heading", { name: ultimo.nome, exact: true }).waitFor();
  assert.equal(await comando.todas.getAttribute("aria-current"), null);
  for (const largura of [320, 375, 1280]) {
    await page.setViewportSize({ width: largura, height: 800 });
    assert.equal(
      await page
        .getByRole("button", {
          name: "Trocar projeto",
          exact: true,
        })
        .count(),
      1,
    );
    await conferirCabecalho(`${largura}px no último projeto`);
  }
  await comando.abrir();
  await page.getByRole("dialog", { name: "Trocar projeto", exact: true }).waitFor();
  assert.equal(
    await comando.dialogo.locator(".e-projetos-comando-busca > svg").count(),
    0,
  );
  assert.equal(await comando.opcao(`${ultimo.nome} (atual)`).count(), 1);
  assert.equal(
    await comando.lista.getByRole("option", { name: /\(atual\)$/ }).count(),
    1,
  );
  const historico = await page.evaluate(() => history.length);
  await comando.opcao(`${ultimo.nome} (atual)`).click();
  await fechado();
  assert.equal(caminho(), `/projetos/${ultimo.id}`);
  assert.equal(await page.evaluate(() => history.length), historico);
  console.log(
    "OK: a barra oferece Trocar projeto e o painel indica o projeto atual",
  );

  await abrirRota("/");
  await marcarSemRecarga();
  await comando.todas.focus();
  await page.keyboard.press("Tab");
  await esperarFoco(comando.gatilho, "o Tab vai de Todas ao comando");
  assert.equal(await focoVisivel(comando.gatilho), true);
  await page.keyboard.press("Enter");
  await comando.busca.waitFor();
  await esperarFoco(comando.busca, "o diálogo abre com o foco na busca");
  assert.equal(await comando.opcao("Todas (atual)").count(), 1);
  for (let passo = 0; passo < 6; passo++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await comando.dialogo.evaluate((el) =>
        el.contains(document.activeElement),
      ),
      true,
      "o diálogo prende o foco",
    );
  }
  const fechar = comando.dialogo.getByRole("button", {
    name: "Fechar",
    exact: true,
  });
  await fechar.click();
  await fechado();
  await esperarFoco(comando.gatilho, "Fechar devolve o foco ao comando");
  await page.keyboard.press("Enter");
  await esperarFoco(comando.busca, "o comando reabre na busca");
  await comando.busca.fill("projeto de teste");
  await page.keyboard.press("Escape");
  await fechado();
  await esperarFoco(comando.gatilho, "Escape devolve o foco ao comando");
  await page.keyboard.press("Enter");
  await comando.busca.waitFor();
  assert.equal(await comando.busca.inputValue(), "");
  await comando.busca.fill("  REVISAO   de producao agil ");
  await comando.opcao(acentuado).waitFor();
  assert.equal(await comando.opcoes.count(), 1);
  await comando.busca.fill("projeto inexistente");
  await comando.dialogo
    .getByText("Nenhum projeto encontrado.", { exact: true })
    .waitFor();
  await page.keyboard.press("Enter");
  assert.equal(caminho(), "/");
  await comando.busca.fill("Projeto de teste 1");
  await comando.opcao("Projeto de teste 19").waitFor();
  assert.equal(await comando.opcoes.count(), 11);
  await page.keyboard.press("ArrowDown");
  if ((await destacada()) !== "Projeto de teste 1")
    await page.keyboard.press("ArrowUp");
  await esperarDestacada("Projeto de teste 1");
  await page.keyboard.press("ArrowDown");
  await esperarDestacada("Projeto de teste 10");
  await page.keyboard.press("ArrowDown");
  await esperarDestacada("Projeto de teste 11");
  await page.keyboard.press("ArrowUp");
  await esperarDestacada("Projeto de teste 10");
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Projeto de teste 10", exact: true })
    .waitFor();
  await fechado();
  await conferirSemRecarga();
  console.log(
    "OK: teclado, setas, Enter, busca sem acento, resultado vazio, Fechar, Escape e foco funcionam sem recarregar",
  );

  for (const [rota, nome] of [
    ["/", "Lista"],
    ["/quadro", "Quadro"],
  ]) {
    await abrirRota(rota);
    await marcarSemRecarga();
    await comando.ir(primeiro.nome);
    await page.waitForURL((url) => url.pathname === `/projetos/${primeiro.id}`);
    await comando.todas.click();
    await page.waitForURL((url) => url.pathname === rota);
    await comando.ir(primeiro.nome);
    await page.waitForURL((url) => url.pathname === `/projetos/${primeiro.id}`);
    await comando.ir("Todas");
    await page.waitForURL((url) => url.pathname === rota);
    await comando.todas.and(page.locator('[aria-current="page"]')).waitFor();
    await conferirSemRecarga();
    console.log(`OK: o link e a opção Todas retornam a ${nome}`);
  }
  await contexto.close();

  for (const sistema of SISTEMAS) {
    const atual = await novaPagina(sistema);
    const mac = sistema.nome === "macOS";
    const dialogo = atual.comando.dialogo;
    await atual.page.goto(`${web}/`);
    await atual.comando.gatilho.waitFor();
    await atual.page.locator("[data-task-id]").first().waitFor();

    const rotulo = await atual.comando.gatilho.evaluate((el) =>
      (el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" "),
    );
    assert.match(
      rotulo,
      mac ? /Option\s*\+?\s*P/ : /Alt\s*\+?\s*P/,
      `${sistema.nome}: descrição do atalho`,
    );
    assert.match(
      await atual.comando.gatilho.locator("kbd").innerText(),
      mac ? /^⌥\s*P$/ : /^Alt\s*\+\s*P$/,
      `${sistema.nome}: rótulo visível do atalho`,
    );

    const disparar = (extras = {}) =>
      atual.page.evaluate((opcoes) => {
        const evento = new KeyboardEvent("keydown", {
          key: "p",
          code: "KeyP",
          altKey: true,
          bubbles: true,
          cancelable: true,
          ...opcoes,
        });
        (document.activeElement || document.body).dispatchEvent(evento);
        return evento.defaultPrevented;
      }, extras);
    async function ignorado(descricao, acao) {
      await acao();
      await atual.page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      assert.equal(
        await dialogo.count(),
        0,
        `${sistema.nome}: ${descricao} não abre o comando`,
      );
    }
    async function aceito(acao) {
      await acao();
      await atual.comando.busca.waitFor();
      await atual.page.keyboard.press("Escape");
      await dialogo.waitFor({ state: "detached" });
    }

    await aceito(() => atual.page.keyboard.press("Alt+KeyP"));
    if (mac) {
      await aceito(() => disparar({ key: "π" }));
      await aceito(() => disparar({ key: "p", code: "KeyR" }));
    } else {
      await ignorado("AltGr", () => disparar({ modifierAltGraph: true }));
    }
    await ignorado("P sem Alt", () => disparar({ altKey: false }));
    for (const modificador of ["ctrlKey", "metaKey", "shiftKey"])
      await ignorado(`Alt+P com ${modificador}`, () =>
        disparar({ [modificador]: true }),
      );
    await ignorado("composição em andamento", () =>
      disparar({ isComposing: true }),
    );
    await ignorado("tecla repetida", () => disparar({ repeat: true }));

    await atual.page.evaluate(() => {
      window.tratar = (evento) => evento.preventDefault();
      window.addEventListener("keydown", window.tratar, true);
    });
    await ignorado("evento já tratado", () =>
      atual.page.keyboard.press("Alt+KeyP"),
    );
    await atual.page.evaluate(() =>
      window.removeEventListener("keydown", window.tratar, true),
    );

    const campo = atual.page.getByRole("searchbox", {
      name: "Buscar por título",
    });
    await campo.focus();
    await ignorado("Alt+P num campo de texto", () =>
      atual.page.keyboard.press("Alt+KeyP"),
    );
    await campo.evaluate((el) => el.blur());

    await atual.page.locator("[data-task-id] .e-task-title").first().click();
    await atual.page.getByRole("dialog").waitFor();
    await ignorado("Alt+P com a ficha aberta", () =>
      atual.page.keyboard.press("Alt+KeyP"),
    );
    assert.equal(await atual.page.getByRole("dialog").count(), 1);
    await atual.contexto.close();
    console.log(
      `OK: ${sistema.nome}: rótulo e atalho corretos, respeitando campo, composição, modificadores, evento tratado e modal`,
    );
  }

  const vazio = await novaPagina();
  await vazio.page.route(`${api}/projetos`, (rota) =>
    rota.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: "[]",
    }),
  );
  const resposta = vazio.page.waitForResponse(`${api}/projetos`);
  await vazio.page.goto(`${web}/`);
  await (await resposta).finished();
  await vazio.comando.todas.waitFor();
  await vazio.comando.nav.getByRole("status").waitFor({ state: "detached" });
  assert.equal(await vazio.comando.gatilho.count(), 0);
  await vazio.page.keyboard.press("Alt+KeyP");
  assert.equal(await vazio.comando.dialogo.count(), 0);
  await vazio.contexto.close();
  console.log("OK: sem projetos, Todas permanece e o comando não é oferecido");

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
