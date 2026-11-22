const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { focoVisivel, contraste } = require("./ui.cts");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

const raiz = join(__dirname, "..");
let browser;

const paginas = [
  "/",
  "/quadro",
  "/projetos",
  "/projetos/1",
  "/rota-inexistente",
];
const fichas = [
  "/tarefas/1",
  "/tarefas/nova",
  "/tarefas/1/editar",
  "/projetos/novo",
  "/projetos/1/editar",
];
const larguras = [1280, 850, 800, 650, 375, 320];

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-a11y-" });
  const { api, web } = await apoio.subirAmbiente({ banco });

  browser = await apoio.abrirNavegador();
  const errosPagina = [];
  async function abrir(page, caminho) {
    await page.goto(`${web}${caminho}`);
    await page
      .locator(
        "main h1, .e-form-overlay [role=dialog] h2, .e-form-overlay [role=dialog] form",
      )
      .first()
      .waitFor();
    await page.waitForFunction(
      () =>
        !document.querySelector(
          ".e-loading-state, .e-ficha-state[role=status], .e-resumo-projeto[data-carregando]",
        ) &&
        document
          .getAnimations()
          .every(
            (animacao) =>
              animacao.effect?.getTiming().iterations === Infinity ||
              animacao.playState !== "running",
          ),
    );
  }

  for (const tema of ["dark"]) {
    const page = await browser.newPage({
      colorScheme: tema,
      viewport: { width: 1280, height: 900 },
    });
    page.setDefaultTimeout(10000);
    page.on("pageerror", (erro) => errosPagina.push(erro.message));

    const dadosLongos = JSON.parse(seedOriginal);
    dadosLongos.projetos = [
      {
        ...dadosLongos.projetos[0],
        nome: "ProjetoSemEspacos".repeat(15),
        descricao: "DescricaoSemEspacos".repeat(20),
        disciplina: "DisciplinaSemEspacos".repeat(12),
      },
    ];
    dadosLongos.tarefas = [
      {
        ...dadosLongos.tarefas[0],
        projetoId: dadosLongos.projetos[0].id,
        titulo: "TituloSemEspacos".repeat(19),
        responsavel: "ResponsavelSemEspacos".repeat(13),
      },
    ];
    const rotaDadosLongos = `${api}/**`;
    await page.route(rotaDadosLongos, (rota) => {
      const url = new URL(rota.request().url());
      const [colecao, id] = url.pathname.split("/").filter(Boolean);
      const registros = dadosLongos[colecao];
      let dados = id
        ? registros?.find((registro) => registro.id === id)
        : registros;
      if (dados && url.searchParams.has("_embed"))
        dados = {
          ...dados,
          tarefas: dadosLongos.tarefas.filter(
            (tarefa) => tarefa.projetoId === id,
          ),
        };
      return rota.fulfill({ status: dados ? 200 : 404, json: dados ?? {} });
    });
    for (const largura of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const caminho of [
        "/",
        "/quadro",
        "/projetos",
        `/projetos/${dadosLongos.projetos[0].id}`,
        `/tarefas/${dadosLongos.tarefas[0].id}`,
      ]) {
        await abrir(page, caminho);
        const conferirTexto = async () => {
          const problemas = await page.evaluate(() => {
            const problemas = [];
            if (
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth
            )
              problemas.push("rolagem horizontal na página");
            const seletores = [
              ".e-task-project",
              ".e-card-pessoa",
              ".e-card-prazo",
              ".e-tools h1:not(.e-task-page-title)",
              ".e-resumo-titulo:focus",
              ".e-resumo-rotulo > span:first-of-type",
              ".e-resumo-assunto",
              ".e-resumo-data",
              ".e-read-project>a",
              ".e-read-meta p",
              ".fol-prazo",
              ".fol-quem",
              ".e-confirm-dialog>p",
              ".e-panel-scroll",
            ];
            for (const seletor of seletores)
              for (const el of document.querySelectorAll(seletor)) {
                const caixa = el.getBoundingClientRect();
                const pai = el.parentElement.getBoundingClientRect();
                if (el.scrollWidth > el.clientWidth + 1)
                  problemas.push(`${seletor}: conteúdo excede a largura`);
                if (
                  caixa.right > pai.right + 1 ||
                  caixa.left < pai.left - 1 ||
                  caixa.right > innerWidth + 1 ||
                  caixa.left < -1
                )
                  problemas.push(`${seletor}: fora do contêiner`);
                // O texto só para leitor de tela (.sr-only) não ocupa lugar.
                const texto = document.createRange();
                const nos = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                const retangulos = [];
                while (nos.nextNode()) {
                  if (nos.currentNode.parentElement.closest(".sr-only"))
                    continue;
                  texto.selectNodeContents(nos.currentNode);
                  retangulos.push(...texto.getClientRects());
                }
                if (
                  retangulos.some(
                    (r) => r.right > caixa.right + 1 || r.left < caixa.left - 1,
                  )
                )
                  problemas.push(`${seletor}: texto cortado ou vazando`);
              }
            return problemas;
          });
          assert.deepEqual(
            problemas,
            [],
            `${largura}px ${caminho}: textos sem espaços`,
          );
        };
        await conferirTexto();
        if (caminho === `/projetos/${dadosLongos.projetos[0].id}`) {
          await page
            .getByRole("heading", {
              level: 1,
              name: dadosLongos.projetos[0].nome,
              exact: true,
            })
            .focus();
          await conferirTexto();
        }
        if (caminho === "/") {
          await page.locator(".e-task-menu").click();
          await page
            .getByRole("menuitem", { name: "Excluir tarefa", exact: true })
            .click();
          await page.locator(".e-confirm-dialog").waitFor();
          await page.waitForFunction(() =>
            document
              .getAnimations()
              .every(
                (a) =>
                  a.effect?.getTiming().iterations === Infinity ||
                  a.playState !== "running",
              ),
          );
          await conferirTexto();
          assert.equal(
            await page.locator(".e-confirm-dialog>p").textContent(),
            `Deseja excluir “${dadosLongos.tarefas[0].titulo}”? Esta ação não pode ser desfeita.`,
          );
          await page
            .getByRole("button", { name: "Cancelar", exact: true })
            .click();
        }
      }
    }
    await page.unroute(rotaDadosLongos);
    console.log(
      `OK: ${tema}: textos sem espaços cabem na lista, quadro, projetos, projeto, ficha e confirmação em 320, 375, 768 e 1280 px; prazos continuam visíveis`,
    );

    for (const largura of [1280, 375, 320]) {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const caminho of ["/", "/tarefas/nova"]) {
        await abrir(page, caminho);
        await page.evaluate(() => {
          const tamanhos = [...document.querySelectorAll("body, body *")].map(
            (el) =>
              [el, parseFloat(getComputedStyle(el).fontSize) / 16] as [
                HTMLElement,
                number,
              ],
          );
          for (const [el, tamanho] of tamanhos)
            el.style.setProperty("font-size", `${tamanho}rem`, "important");
          document.documentElement.style.setProperty(
            "font-size",
            "32px",
            "important",
          );
        });
        const problemas = await page.evaluate(() => {
          const problemas = [];
          const seletores = [
            ".e-top nav a",
            ".e-form-two [data-label]",
            ".e-form-footer button",
          ];
          for (const seletor of seletores)
            for (const el of document.querySelectorAll(seletor)) {
              const caixa = el.getBoundingClientRect();
              const pai = el.parentElement.getBoundingClientRect();
              const texto = document.createRange();
              texto.selectNodeContents(el);
              const retangulos = [...texto.getClientRects()].filter(
                (r) => r.width && r.height,
              );
              if (
                caixa.left < 0 ||
                caixa.right > innerWidth + 1 ||
                caixa.left < pai.left - 1 ||
                caixa.right > pai.right + 1
              )
                problemas.push(`${seletor}: fora do contêiner`);
              if (
                !el.closest(".e-tarefa-atalhos") &&
                retangulos.some(
                  (r) =>
                    r.left < caixa.left - 1 ||
                    r.right > caixa.right + 1 ||
                    r.top < caixa.top - 1 ||
                    r.bottom > caixa.bottom + 1,
                )
              )
                problemas.push(`${seletor}: texto cortado`);
            }
          const sobrepoe = (a, b) =>
            a.left < b.right - 1 &&
            a.right > b.left + 1 &&
            a.top < b.bottom - 1 &&
            a.bottom > b.top + 1;
          for (const seletor of [
            ".e-top nav a",
            ".e-top > *",
            ".e-form-two",
            ".e-form-footer",
          ]) {
            const grupos =
              seletor === ".e-form-two" || seletor === ".e-form-footer"
                ? [...document.querySelectorAll(seletor)].map((el) => [
                    ...el.children,
                  ])
                : [[...document.querySelectorAll(seletor)]];
            for (const grupo of grupos)
              for (let i = 0; i < grupo.length; i++)
                for (let j = i + 1; j < grupo.length; j++) {
                  if (
                    sobrepoe(
                      grupo[i].getBoundingClientRect(),
                      grupo[j].getBoundingClientRect(),
                    )
                  )
                    problemas.push(`${seletor}: sobreposição`);
                }
          }
          return problemas;
        });
        assert.deepEqual(
          problemas,
          [],
          `${largura}px ${caminho}: texto ampliado a 200%`,
        );
        if (caminho === "/tarefas/nova") {
          const cancelar = page.getByRole("button", {
            name: "Cancelar",
            exact: true,
          });
          await page
            .getByRole("button", { name: "Fechar nova tarefa", exact: true })
            .focus();
          let alcancou = false;
          for (let i = 0; i < 20; i++) {
            await page.keyboard.press("Tab");
            if (
              await cancelar.evaluate((el) => el === document.activeElement)
            ) {
              alcancou = true;
              break;
            }
          }
          assert.equal(
            alcancou,
            true,
            `${largura}px: Cancelar alcançável por Tab com texto 200%`,
          );
          assert.equal(
            await focoVisivel(cancelar),
            true,
            `${largura}px: Cancelar sem foco visível com texto 200%`,
          );
          await page.getByLabel(/^Responsável/).fill("Ana");
          await cancelar.click();
          await page.waitForURL(`${web}/`);
        }
      }
    }
    console.log(
      "OK: texto 200% por fontes computadas em rem e raiz 32px; navegação, rótulos e ações sem sobreposição/corte em 1280, 375 e 320 px; Cancelar acessível e funcional",
    );

    for (const largura of larguras) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await abrir(page, caminho);
        if (largura === 320 && caminho === "/") {
          const topo = page.locator(".e-top");
          assert(
            await topo.locator(".e-top-palavra").isVisible(),
            "marca Pixel visível em 320 px",
          );
          const partes = await topo
            .locator(":scope > *")
            .evaluateAll((elementos) =>
              elementos.map((el) => {
                const { top, bottom } = el.getBoundingClientRect();
                return { top, bottom };
              }),
            );
          const meio = (partes[0].top + partes[0].bottom) / 2;
          assert(
            partes.every(({ top, bottom }) => top <= meio && bottom > meio),
            "marca, navegação e ações ficam na mesma linha em 320 px",
          );
        }
        const problema = await page.evaluate(() => {
          if (
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
          )
            return `rolagem horizontal (${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth})`;
          const faixa = (el) => Boolean(el.closest(".e-tabs"));
          const transbordo = [...document.querySelectorAll("body *")].find(
            (el) =>
              !faixa(el) &&
              /(auto|scroll)/.test(getComputedStyle(el).overflowX) &&
              el.scrollWidth > el.clientWidth + 1,
          );
          if (transbordo)
            return `${transbordo.tagName}.${transbordo.className} rola na horizontal (${transbordo.scrollWidth} > ${transbordo.clientWidth})`;
          const rolavel = (el) => {
            for (let pai = el.parentElement; pai; pai = pai.parentElement)
              if (/(auto|scroll)/.test(getComputedStyle(pai).overflowX))
                return true;
            return false;
          };
          const fora = [...document.querySelectorAll("body *")].find((el) => {
            const caixa = el.getBoundingClientRect();
            return (
              caixa.width > 0 &&
              caixa.height > 0 &&
              getComputedStyle(el).visibility !== "hidden" &&
              (caixa.right > innerWidth + 1 || caixa.left < -1) &&
              !rolavel(el)
            );
          });
          return fora ? `${fora.tagName}.${fora.className} fora da tela` : null;
        });
        assert.equal(problema, null, `${tema} ${largura}px ${caminho}`);
      }
    }
    console.log(
      `OK: ${tema}: ${paginas.length + fichas.length} rotas sem rolagem horizontal em ${larguras.join(", ")} px`,
    );

    for (const largura of [1280, 375]) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await abrir(page, caminho);
        const ficha = fichas.includes(caminho);
        if (!ficha)
          await page.evaluate(
            () =>
              document.activeElement instanceof HTMLElement &&
              document.activeElement.blur(),
          );
        const paradas = [];
        let ciclo = false;
        let saiu = false;
        for (let tentativa = 0; tentativa < 120; tentativa++) {
          await page.keyboard.press("Tab");
          const foco = page.locator(":focus");
          if ((await foco.count()) === 0) {
            saiu = true;
            break;
          }
          const parada = await foco.evaluate((el) => {
            const caixa = el.getBoundingClientRect();
            const repetida = el.hasAttribute("data-parada-tab");
            el.setAttribute("data-parada-tab", "");
            return {
              repetida,
              nome: `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}"`,
              naTela:
                caixa.width > 0 &&
                caixa.height > 0 &&
                caixa.bottom > 0 &&
                caixa.top < innerHeight &&
                caixa.right > 0 &&
                caixa.left < innerWidth,
              naFicha: Boolean(el.closest(".e-form-overlay")),
            };
          });
          if (parada.repetida) {
            ciclo = true;
            break;
          }
          paradas.push(parada);
          assert.equal(
            await focoVisivel(foco),
            true,
            `${tema} ${largura}px ${caminho}: sem foco visível em ${parada.nome}`,
          );
          assert.equal(
            parada.naTela,
            true,
            `${tema} ${largura}px ${caminho}: ${parada.nome} fora da tela`,
          );
          if (ficha)
            assert.equal(
              parada.naFicha,
              true,
              `${tema} ${largura}px ${caminho}: o Tab saiu da ficha para ${parada.nome}`,
            );
        }
        assert.ok(
          paradas.length >= (ficha ? 2 : 4),
          `${tema} ${largura}px ${caminho}: só ${paradas.length} paradas`,
        );
        assert.ok(
          ciclo || saiu,
          `${tema} ${largura}px ${caminho}: o percurso não terminou em ${paradas.length} paradas`,
        );
        if (ficha)
          assert.equal(
            saiu,
            false,
            `${tema} ${largura}px ${caminho}: o foco saiu da ficha`,
          );
        const esquecidos = await page.evaluate((ficha) => {
          const escopo = ficha
            ? document.querySelector(".e-form-overlay [role=dialog]")
            : document;
          return [
            ...escopo.querySelectorAll(
              "a[href], button, input, select, textarea, [tabindex]",
            ),
          ]
            .filter(
              (el: HTMLButtonElement) =>
                el.tabIndex >= 0 &&
                !el.disabled &&
                el.getClientRects().length > 0 &&
                getComputedStyle(el).visibility !== "hidden" &&
                !el.closest("[inert], [aria-hidden=true]"),
            )
            .filter((el) => !el.hasAttribute("data-parada-tab"))
            .map(
              (el) =>
                `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`,
            );
        }, ficha);
        assert.deepEqual(
          esquecidos,
          [],
          `${tema} ${largura}px ${caminho}: o Tab não alcança estes elementos`,
        );
      }
    }
    console.log(
      `OK: ${tema}: foco visível e na tela em todas as paradas do Tab; a ficha prende o foco`,
    );

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const caminho of ["/tarefas/nova", "/projetos/novo"]) {
      await abrir(page, caminho);
      await page
        .getByRole("button", { name: "Adicionar descrição", exact: true })
        .click();
      const descricao = page.getByRole("textbox", {
        name: "Descrição",
        exact: true,
      });
      assert.equal(
        await descricao.getAttribute("placeholder"),
        "Descrição (opcional)",
      );
      const [cor, fundo] = await descricao.evaluate((el) => {
        const estiloPlaceholder = getComputedStyle(el, "::placeholder");
        let opacidade = Number(estiloPlaceholder.opacity);
        for (let atual = el; atual; atual = atual.parentElement)
          opacidade *= Number(getComputedStyle(atual).opacity);
        let fundo = "rgba(0, 0, 0, 0)";
        for (
          let atual = el;
          atual && /rgba\(0, 0, 0, 0\)|transparent/.test(fundo);
          atual = atual.parentElement
        )
          fundo = getComputedStyle(atual).backgroundColor;
        const [r, g, b] = estiloPlaceholder.color.match(/[\d.]+/g).map(Number);
        const [fr, fg, fb] = fundo.match(/[\d.]+/g).map(Number);
        const misturar = (c, f) =>
          Math.round(c * opacidade + f * (1 - opacidade));
        return [
          `rgb(${misturar(r, fr)}, ${misturar(g, fg)}, ${misturar(b, fb)})`,
          fundo,
        ];
      });
      assert.ok(
        contraste(cor, fundo) >= 4.5,
        `${tema} ${caminho}: "opcional" com contraste ${contraste(cor, fundo).toFixed(2)}:1`,
      );
    }
    console.log(
      `OK: ${tema}: "opcional" da descrição com contraste de pelo menos 4,5:1 na Nova tarefa e no Novo projeto`,
    );
    await page.close();
  }

  const abrirCelular = async () => {
    const aba = await browser.newPage({
      viewport: { width: 375, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
    aba.setDefaultTimeout(10000);
    aba.on("pageerror", (erro) => errosPagina.push(erro.message));
    return aba;
  };
  const page = await abrirCelular();
  const semFonte = await abrirCelular();
  await semFonte.route(/fonts\.(googleapis|gstatic)\.com/, (rota) =>
    rota.abort().catch(() => {}),
  );
  const prepararFonte = async (aba, fonte, caminho) => {
    await abrir(aba, caminho);
    const commissioner = await aba.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (face) =>
          face.family.replace(/"/g, "") === "Commissioner" &&
          face.status === "loaded",
      );
    });
    if (fonte === "reserva")
      assert.equal(
        commissioner,
        false,
        `${caminho}: a Commissioner carregou mesmo bloqueada`,
      );
  };
  for (const [fonte, aba] of [
    ["web", page],
    ["reserva", semFonte],
  ]) {
    for (const largura of [375, 320]) {
      await aba.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await prepararFonte(aba, fonte, caminho);
        const pequenos = await aba.evaluate(() =>
          [
            ...document.querySelectorAll(
              'a[href], button, input:not([type=hidden]), textarea, [role="button"], [role="link"]',
            ),
          ].flatMap((el) => {
            const caixa = el.getBoundingClientRect();
            if (
              !caixa.width ||
              !caixa.height ||
              getComputedStyle(el).visibility === "hidden"
            )
              return [];
            for (
              let atual = el;
              atual && atual !== document.body;
              atual = atual.parentElement
            ) {
              const estilo = getComputedStyle(atual);
              if (
                estilo.clipPath.startsWith("inset(50%") ||
                (estilo.clip !== "auto" && estilo.position === "absolute")
              )
                return [];
            }
            if (el.matches("a") && el.closest("p, dd, li:not([role])"))
              return [];
            const area = ["::after", "::before"]
              .map((pseudo) => getComputedStyle(el, pseudo))
              .filter(
                (estilo) =>
                  estilo.content !== "none" && estilo.position === "absolute",
              )
              .map((estilo) => [
                parseFloat(estilo.width) || 0,
                parseFloat(estilo.height) || 0,
              ]);
            const largura = Math.max(caixa.width, ...area.map(([l]) => l));
            const altura = Math.max(caixa.height, ...area.map(([, a]) => a));
            return largura < 43.5 || altura < 43.5
              ? [
                  `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 30)}" ${Math.round(largura)}×${Math.round(altura)}`,
                ]
              : [];
          }),
        );
        assert.deepEqual(
          pequenos,
          [],
          `fonte ${fonte}, ${largura}px ${caminho}`,
        );
      }
    }
  }
  console.log(
    "OK: alvos de toque com pelo menos 44 × 44 px em 375 e 320 px, com a fonte da web e com a de reserva",
  );

  for (const largura of [375, 320]) {
    await page.setViewportSize({ width: largura, height: 800 });
    await prepararFonte(page, "web", "/");
    await page.locator(".e-task-menu").first().click();
    await page
      .getByRole("menuitem", { name: "Excluir tarefa", exact: true })
      .click();
    await page.locator(".e-confirm-dialog").waitFor();
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.effect?.getTiming().iterations === Infinity ||
            a.playState !== "running",
        ),
    );
    const alturas = await page
      .locator(".e-confirm-actions button")
      .evaluateAll((botoes) =>
        botoes.map((b) => Math.round(b.getBoundingClientRect().height)),
      );
    assert.equal(alturas.length, 2, `${largura}px: botões da confirmação`);
    assert.ok(
      alturas.every((altura) => altura >= 44),
      `${largura}px: botões da confirmação com ${alturas.join(" e ")} px de altura`,
    );
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
  console.log(
    "OK: botões da confirmação de exclusão com pelo menos 44 px de altura em 375 e 320 px",
  );

  for (const [fonte, aba] of [
    ["web", page],
    ["reserva", semFonte],
  ]) {
    await aba.setViewportSize({ width: 375, height: 800 });
    for (const [caminho, seletor, vizinhos] of [
      ["/projetos", ".e-project-card h2 a", [".e-project-card > p"]],
      [
        "/tarefas/1",
        ".e-read-project > a",
        [".fol-prazo", ".e-read-tags", ".fol-quem", ".e-read-description"],
      ],
    ]) {
      await prepararFonte(aba, fonte, caminho);
      const sobreposto = await aba.evaluate(
        ([seletor, vizinhos]) => {
          const link = document.querySelector(seletor);
          link.focus({ focusVisible: true });
          const estilo = getComputedStyle(link);
          const margem =
            parseFloat(estilo.outlineOffset) + parseFloat(estilo.outlineWidth);
          const caixa = link.getBoundingClientRect();
          const anel = {
            top: caixa.top - margem,
            bottom: caixa.bottom + margem,
            left: caixa.left - margem,
            right: caixa.right + margem,
          };
          return vizinhos
            .map((vizinho) => [
              vizinho,
              link
                .closest("article, section")
                .querySelector(vizinho)
                .getBoundingClientRect(),
            ])
            .filter(
              ([, outro]) =>
                anel.bottom > outro.top + 0.5 &&
                anel.top < outro.bottom - 0.5 &&
                anel.right > outro.left + 0.5 &&
                anel.left < outro.right - 0.5,
            )
            .map(([vizinho]) => vizinho);
        },
        [seletor, vizinhos],
      );
      assert.deepEqual(
        sobreposto,
        [],
        `fonte ${fonte}, ${caminho}: o anel de foco de ${seletor} cobre o texto vizinho`,
      );
    }
  }
  await semFonte.close();
  console.log(
    "OK: o anel de foco dos links ampliados não cobre o texto vizinho, com a fonte da web e com a de reserva",
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, "/");
  const link = page.getByRole("link", {
    name: "Criar o repositório",
    exact: true,
  });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(`${web}/tarefas/1`);
  await page
    .locator(".e-form-overlay")
    .getByRole("heading", { name: "Criar o repositório" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.waitForURL(`${web}/`);
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Criar o repositório",
  );
  console.log("OK: Enter abre a ficha e Esc fecha devolvendo o foco ao link");

  const idsDaLista = await page
    .locator(".e-row[data-task-id]")
    .evaluateAll((linhas) => linhas.map((linha) => linha.dataset.taskId));
  for (const id of [idsDaLista[0], idsDaLista.at(-1)]) {
    await page.goto(`${web}/tarefas/${id}`);
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Fechar detalhes da tarefa",
    );
    await page.locator(`.e-row[data-task-id="${id}"]`).waitFor();
    await page.keyboard.press("Escape");
    await page.waitForURL(`${web}/`);
    await page.waitForFunction(
      (id) =>
        document.activeElement ===
        document.querySelector(`[data-task-id="${id}"] .e-task-title`),
      id,
    );
    assert.equal(
      await page.evaluate(() => {
        const caixa = document.activeElement.getBoundingClientRect();
        const topo = document.querySelector(".e-top").getBoundingClientRect();
        return caixa.top >= topo.bottom && caixa.bottom <= innerHeight;
      }),
      true,
      `tarefa ${id}: o cartão focado ficou fora da tela`,
    );
  }
  console.log(
    "OK: ficha aberta pelo endereço devolve o foco ao cartão da tarefa, à vista",
  );

  for (const largura of [1280, 375]) {
    await page.setViewportSize({ width: largura, height: 800 });
    for (const caminho of paginas) {
      await abrir(page, caminho);
      const antes = await page.evaluate(() => ({
        href: location.href,
        entradas: history.length,
        idx: history.state?.idx ?? null,
      }));
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      const escondido = await page.locator(".e-pular").evaluate((el) => {
        const estilo = getComputedStyle(el);
        const caixa = el.getBoundingClientRect();
        return (
          estilo.position === "absolute" &&
          estilo.clip !== "auto" &&
          caixa.width <= 2 &&
          caixa.height <= 2
        );
      });
      assert.equal(
        escondido,
        true,
        `${largura}px ${caminho}: o atalho aparece sem foco`,
      );
      await page.keyboard.press("Tab");
      const link = page.locator(".e-pular");
      assert.equal(
        await link.evaluate((el) => el === document.activeElement),
        true,
        `${largura}px ${caminho}: o atalho não é a primeira parada`,
      );
      assert.equal((await link.innerText()).trim(), "Pular para o conteúdo");
      assert.equal(
        await focoVisivel(link),
        true,
        `${largura}px ${caminho}: atalho sem foco visível`,
      );
      const sobreOHeader = await link.evaluate((el) => {
        const caixa = el.getBoundingClientRect();
        const header = document.querySelector(".e-top").getBoundingClientRect();
        return (
          caixa.height >= 44 &&
          caixa.width >= 44 &&
          caixa.top >= 0 &&
          caixa.left >= 0 &&
          caixa.right <= innerWidth &&
          caixa.bottom > header.top &&
          caixa.top < header.bottom
        );
      });
      assert.equal(
        sobreOHeader,
        true,
        `${largura}px ${caminho}: o atalho focado não fica sobre o header ou tem menos de 44 px`,
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.activeElement === document.querySelector("main h1"),
      );
      const destino = await page.evaluate(() => {
        const titulo = document.querySelector("main h1");
        const caixa = titulo.getBoundingClientRect();
        const header = document.querySelector(".e-top").getBoundingClientRect();
        const escondido = titulo.classList.contains("e-task-page-title");
        return {
          coberto: !escondido && caixa.top < header.bottom - 1,
          hash: location.hash,
        };
      });
      assert.equal(
        destino.coberto,
        false,
        `${largura}px ${caminho}: o título ficou sob o header`,
      );
      assert.equal(destino.hash, "");
      const depois = await page.evaluate(() => ({
        href: location.href,
        entradas: history.length,
        idx: history.state?.idx ?? null,
      }));
      assert.deepEqual(
        depois,
        antes,
        `${largura}px ${caminho}: o atalho alterou a URL ou o histórico`,
      );
      if (caminho === "/" || caminho === "/quadro") {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () => document.activeElement?.closest(".e-task-search") !== null,
          ),
          true,
          `${largura}px ${caminho}: o Tab seguinte não caiu na busca`,
        );
        const buscaLivre = await page.evaluate(() => {
          const busca = document
            .querySelector(".e-task-search")
            .getBoundingClientRect();
          const header = document
            .querySelector(".e-top")
            .getBoundingClientRect();
          return busca.top >= header.bottom - 1 && busca.bottom > busca.top;
        });
        assert.equal(
          buscaLivre,
          true,
          `${largura}px ${caminho}: a busca ficou sob o header`,
        );
      }
    }
    await abrir(page, "/");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.keyboard.press("Tab");
    await page.locator(".e-pular").click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector("main h1"),
    );
    assert.equal(
      new URL(page.url()).hash,
      "",
      `${largura}px: o clique pôs um hash na URL`,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest(".e-task-search") !== null,
      ),
      true,
      `${largura}px: depois do clique, o Tab não caiu na busca`,
    );
    await abrir(page, "/tarefas/1");
    const interferiu = await page.evaluate(() => {
      const link = document.querySelector(".e-pular");
      const caixa = link.getBoundingClientRect();
      return (
        link.closest("[inert]") === null ||
        caixa.height > 2 ||
        document.activeElement === link
      );
    });
    assert.equal(
      interferiu,
      false,
      `${largura}px: o atalho interfere na ficha`,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.classList.contains("e-pular") ?? false,
      ),
      false,
      `${largura}px: o Tab na ficha caiu no atalho`,
    );
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest(".e-form-overlay") !== null,
      ),
      true,
      `${largura}px: o Tab saiu da ficha`,
    );
  }
  await abrir(page, "/projetos");
  await abrir(page, "/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.activeElement === document.querySelector("main h1"),
  );
  const aposRolagem = await page.evaluate(() => {
    const busca = document
      .querySelector(".e-task-search")
      .getBoundingClientRect();
    const header = document.querySelector(".e-top").getBoundingClientRect();
    return (
      busca.top >= header.bottom - 1 &&
      busca.bottom <= innerHeight &&
      location.pathname === "/"
    );
  });
  assert.equal(
    aposRolagem,
    true,
    "depois de rolar a lista, o atalho não trouxe a busca para baixo do header",
  );
  await page.goBack();
  await page.waitForURL(/\/projetos$/);
  assert.equal(new URL(page.url()).hash, "");
  console.log(
    "OK: Pular para o conteúdo é a primeira parada, leva o foco ao título sem mexer na URL e o Tab seguinte cai na busca",
  );

  const animacoesRodando = (aba) =>
    aba.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    );
  const posicoesLogo = (aba) =>
    aba.evaluate(() =>
      [...document.querySelectorAll(".e-top-gato, .e-top-palavra")].map(
        (el) => getComputedStyle(el).backgroundPositionX,
      ),
    );
  const contexto = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
  });
  const movimento = await contexto.newPage();
  movimento.setDefaultTimeout(10000);
  movimento.on("pageerror", (erro) => errosPagina.push(erro.message));
  await abrir(movimento, "/rota-inexistente");
  assert.equal(
    await movimento.locator(".e-footer-links button").count(),
    0,
    "o rodapé não deve ter botões",
  );
  await movimento.waitForFunction(() =>
    document
      .getAnimations()
      .some(
        (a) =>
          a.playState === "running" &&
          (a.effect as KeyframeEffect)?.target?.matches?.(".e-gato-costas"),
      ),
  );
  await movimento.emulateMedia({ reducedMotion: "reduce" });
  await movimento.reload();
  await movimento.locator(".e-not-found").waitFor();
  assert.equal(
    await animacoesRodando(movimento),
    0,
    "com reduce do sistema, algo animou",
  );
  assert.deepEqual(await posicoesLogo(movimento), ["0px", "0px"]);
  await movimento
    .getByRole("link", { name: "Projetos", exact: true })
    .first()
    .click();
  await movimento.waitForURL(`${web}/projetos`);
  assert.equal(
    await animacoesRodando(movimento),
    0,
    "com reduce do sistema, a troca de página animou",
  );
  assert.deepEqual(await posicoesLogo(movimento), ["0px", "0px"]);
  await contexto.close();
  console.log(
    "OK: rodapé sem botão de animações; o gato anima por padrão e tudo fica parado com reduce do sistema, inclusive na troca de página",
  );

  for (const largura of [1280, 320]) {
    const celular = largura === 320;
    const seletor = await browser.newPage({
      viewport: { width: largura, height: 800 },
      reducedMotion: "reduce",
      hasTouch: celular,
    });
    await abrir(seletor, "/");
    const configuracoes = seletor.getByRole("button", {
      name: "Configurações",
    });
    const aparencia = seletor.getByRole("dialog", { name: "Aparência" });
    const html = seletor.locator("html");
    const temaInicial = await html.getAttribute("data-tema");
    const abrirAparencia = async () => {
      if (celular) await configuracoes.tap();
      else await configuracoes.press("Enter");
      await aparencia.waitFor();
    };

    await abrirAparencia();
    assert.equal(await aparencia.getByRole("radio").count(), 3);
    assert.equal(await aparencia.locator(".e-tema-indicio").count(), 3);
    const fechar = aparencia.getByRole("button", { name: "Fechar" });
    if (celular) await fechar.tap();
    else await fechar.click();
    await aparencia.waitFor({ state: "hidden" });
    assert.equal(await html.getAttribute("data-tema"), temaInicial);
    assert.equal(seletor.url(), `${web}/`);

    await abrirAparencia();
    await seletor.keyboard.press("Escape");
    await aparencia.waitFor({ state: "hidden" });
    await seletor.waitForFunction(() =>
      document.activeElement?.matches(
        '.e-top-configuracoes[aria-expanded="false"]',
      ),
    );

    await abrirAparencia();
    if (celular) await seletor.touchscreen.tap(4, 120);
    else await seletor.mouse.click(4, 120);
    await aparencia.waitFor({ state: "hidden" });
    assert.equal(await html.getAttribute("data-tema"), temaInicial);

    await abrirAparencia();
    const ameixaClara = aparencia.getByText("Ameixa clara", { exact: true });
    if (celular) await ameixaClara.tap();
    else await ameixaClara.click();
    await aparencia.waitFor({ state: "hidden" });
    assert.equal(await html.getAttribute("data-tema"), "ameixa-clara");
    assert.equal(seletor.url(), `${web}/`);

    await seletor.getByRole("link", { name: "Projetos", exact: true }).click();
    await seletor.waitForURL(`${web}/projetos`);
    await seletor.reload();
    await seletor
      .getByRole("heading", { name: "Projetos", exact: true })
      .waitFor();
    assert.equal(await html.getAttribute("data-tema"), "ameixa-clara");
    await seletor.close();
  }

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
