const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador, focoVisivel, contraste } = require("./ui.cjs");

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

const paginas = ["/", "/quadro", "/projetos", "/projetos/1", "/rota-inexistente"];
const fichas = ["/tarefas/1", "/tarefas/nova", "/tarefas/1/editar", "/projetos/novo", "/projetos/1/editar"];
const larguras = [1280, 850, 800, 650, 375, 320];

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  temporario = await mkdtemp(join(tmpdir(), "pixel-a11y-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.seed.json"), banco);
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([esperar(`${api}/tarefas`), esperar(web)]);

  browser = await lancarNavegador();
  const errosPagina = [];
  // Conteúdo pronto: a consulta principal terminou, nenhum indicador de carregamento segue ativo
  // e a ficha terminou de abrir (a animação de entrada a escala de 95% para 100%, o que distorce as medidas).
  async function abrir(page, caminho) {
    await page.goto(`${web}${caminho}`);
    await page.locator("main h1, .e-form-overlay [role=dialog] h2, .e-form-overlay [role=dialog] form").first().waitFor();
    await page.waitForFunction(() => !document.querySelector(".e-loading-state, .e-ficha-state[role=status]")
      && document.getAnimations().every((animacao) => animacao.effect?.getTiming().iterations === Infinity || animacao.playState !== "running"));
  }

  for (const tema of ["light", "dark"]) {
    const page = await browser.newPage({ colorScheme: tema, viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    page.on("pageerror", (erro) => errosPagina.push(erro.message));

    // Telas pequenas: nada rola na horizontal e nenhum elemento sai da tela, salvo dentro de uma faixa rolável (abas de projetos).
    for (const largura of larguras) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await abrir(page, caminho);
        const problema = await page.evaluate(() => {
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth) return `rolagem horizontal (${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth})`;
          // Só as abas de projetos podem rolar de lado; qualquer outro contêiner rolável (o corpo da ficha tem overflow-y:auto) não pode transbordar.
          const faixa = (el) => Boolean(el.closest(".e-tabs"));
          const transbordo = [...document.querySelectorAll("body *")].find((el) => !faixa(el) && /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1);
          if (transbordo) return `${transbordo.tagName}.${transbordo.className} rola na horizontal (${transbordo.scrollWidth} > ${transbordo.clientWidth})`;
          const rolavel = (el) => { for (let pai = el.parentElement; pai; pai = pai.parentElement) if (/(auto|scroll)/.test(getComputedStyle(pai).overflowX)) return true; return false; };
          const fora = [...document.querySelectorAll("body *")].find((el) => {
            const caixa = el.getBoundingClientRect();
            return caixa.width > 0 && caixa.height > 0 && getComputedStyle(el).visibility !== "hidden" && (caixa.right > innerWidth + 1 || caixa.left < -1) && !rolavel(el);
          });
          return fora ? `${fora.tagName}.${fora.className} fora da tela` : null;
        });
        assert.equal(problema, null, `${tema} ${largura}px ${caminho}`);
      }
    }
    console.log(`OK: ${tema}: ${paginas.length + fichas.length} rotas sem rolagem horizontal em ${larguras.join(", ")} px`);

    // Teclado: cada parada do Tab tem foco visível e está na tela; nas páginas, o percurso sai do documento (sem armadilha).
    for (const largura of [1280, 375]) {
      await page.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await abrir(page, caminho);
        const ficha = fichas.includes(caminho);
        if (!ficha) await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
        const paradas = [];
        // Cada elemento é marcado ao receber foco: voltar a um marcado é ciclo; sair do documento encerra o percurso.
        let ciclo = false;
        let saiu = false;
        for (let tentativa = 0; tentativa < 120; tentativa++) {
          await page.keyboard.press("Tab");
          const foco = page.locator(":focus");
          if ((await foco.count()) === 0) { saiu = true; break; }
          const parada = await foco.evaluate((el) => {
            const caixa = el.getBoundingClientRect();
            const repetida = el.hasAttribute("data-parada-tab");
            el.setAttribute("data-parada-tab", "");
            return {
              repetida,
              nome: `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}"`,
              naTela: caixa.width > 0 && caixa.height > 0 && caixa.bottom > 0 && caixa.top < innerHeight && caixa.right > 0 && caixa.left < innerWidth,
              naFicha: Boolean(el.closest(".e-form-overlay")),
            };
          });
          if (parada.repetida) { ciclo = true; break; }
          paradas.push(parada);
          assert.equal(await focoVisivel(foco), true, `${tema} ${largura}px ${caminho}: sem foco visível em ${parada.nome}`);
          assert.equal(parada.naTela, true, `${tema} ${largura}px ${caminho}: ${parada.nome} fora da tela`);
          if (ficha) assert.equal(parada.naFicha, true, `${tema} ${largura}px ${caminho}: o Tab saiu da ficha para ${parada.nome}`);
        }
        assert.ok(paradas.length >= (ficha ? 2 : 4), `${tema} ${largura}px ${caminho}: só ${paradas.length} paradas`);
        // Sem armadilha: ao fechar o ciclo (ou sair do documento), o Tab passou por todos os elementos tabuláveis
        // do escopo — a página inteira, ou só a ficha, que é modal e por isso circula dentro de si.
        assert.ok(ciclo || saiu, `${tema} ${largura}px ${caminho}: o percurso não terminou em ${paradas.length} paradas`);
        if (ficha) assert.equal(saiu, false, `${tema} ${largura}px ${caminho}: o foco saiu da ficha`);
        const esquecidos = await page.evaluate((ficha) => {
          const escopo = ficha ? document.querySelector(".e-form-overlay [role=dialog]") : document;
          return [...escopo.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")]
            .filter((el) => el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[inert], [aria-hidden=true]"))
            .filter((el) => !el.hasAttribute("data-parada-tab"))
            .map((el) => `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`);
        }, ficha);
        assert.deepEqual(esquecidos, [], `${tema} ${largura}px ${caminho}: o Tab não alcança estes elementos`);
      }
    }
    console.log(`OK: ${tema}: foco visível e na tela em todas as paradas do Tab; a ficha prende o foco`);

    // Achado do Lighthouse: o "opcional" da descrição ficava abaixo de 4,5:1 por causa da opacidade.
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, "/tarefas/nova");
    const [cor, fundo] = await page.locator(".e-description-toggle > span").evaluate((el) => {
      let opacidade = 1;
      for (let atual = el; atual; atual = atual.parentElement) opacidade *= Number(getComputedStyle(atual).opacity);
      let fundo = "rgba(0, 0, 0, 0)";
      for (let atual = el; atual && /rgba\(0, 0, 0, 0\)|transparent/.test(fundo); atual = atual.parentElement) fundo = getComputedStyle(atual).backgroundColor;
      const [r, g, b] = getComputedStyle(el).color.match(/[\d.]+/g).map(Number);
      const [fr, fg, fb] = fundo.match(/[\d.]+/g).map(Number);
      const misturar = (c, f) => Math.round(c * opacidade + f * (1 - opacidade));
      return [`rgb(${misturar(r, fr)}, ${misturar(g, fg)}, ${misturar(b, fb)})`, fundo];
    });
    assert.ok(contraste(cor, fundo) >= 4.5, `${tema}: "opcional" com contraste ${contraste(cor, fundo).toFixed(2)}:1`);
    console.log(`OK: ${tema}: "opcional" da descrição com contraste de pelo menos 4,5:1`);
    await page.close();
  }

  // Alvos de toque no celular: controles fora de texto corrido têm ao menos 44 × 44 px (contando a área ampliada por ::after).
  // Roda com a fonte da web e com ela bloqueada: sem a Commissioner o texto cai na fonte de reserva e encolhe,
  // e a área de toque não pode depender disso.
  const abrirCelular = async () => {
    const aba = await browser.newPage({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
    aba.setDefaultTimeout(10000);
    aba.on("pageerror", (erro) => errosPagina.push(erro.message));
    return aba;
  };
  const page = await abrirCelular();
  const semFonte = await abrirCelular();
  await semFonte.route(/fonts\.(googleapis|gstatic)\.com/, (rota) => rota.abort().catch(() => {}));
  const prepararFonte = async (aba, fonte, caminho) => {
    await abrir(aba, caminho);
    const commissioner = await aba.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Commissioner" && face.status === "loaded");
    });
    if (fonte === "reserva") assert.equal(commissioner, false, `${caminho}: a Commissioner carregou mesmo bloqueada`);
  };
  for (const [fonte, aba] of [["web", page], ["reserva", semFonte]]) {
    for (const largura of [375, 320]) {
      await aba.setViewportSize({ width: largura, height: 800 });
      for (const caminho of [...paginas, ...fichas]) {
        await prepararFonte(aba, fonte, caminho);
        const pequenos = await aba.evaluate(() => [...document.querySelectorAll('a[href], button, input:not([type=hidden]), textarea, [role="button"], [role="link"]')].flatMap((el) => {
          const caixa = el.getBoundingClientRect();
          if (!caixa.width || !caixa.height || getComputedStyle(el).visibility === "hidden") return [];
          // Oculto visualmente (botões de dispensar do React Aria) ou dentro de texto corrido.
          for (let atual = el; atual && atual !== document.body; atual = atual.parentElement) {
            const estilo = getComputedStyle(atual);
            if (estilo.clipPath.startsWith("inset(50%") || (estilo.clip !== "auto" && estilo.position === "absolute")) return [];
          }
          if (el.matches("a") && el.closest("p, dd, li:not([role])")) return [];
          const area = ["::after", "::before"].map((pseudo) => getComputedStyle(el, pseudo)).filter((estilo) => estilo.content !== "none" && estilo.position === "absolute").map((estilo) => [parseFloat(estilo.width) || 0, parseFloat(estilo.height) || 0]);
          const largura = Math.max(caixa.width, ...area.map(([l]) => l));
          const altura = Math.max(caixa.height, ...area.map(([, a]) => a));
          // A mensagem mostra a área efetiva (com o pseudo-elemento), não só a caixa do texto.
          return largura < 43.5 || altura < 43.5 ? [`${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 30)}" ${Math.round(largura)}×${Math.round(altura)}`] : [];
        }));
        assert.deepEqual(pequenos, [], `fonte ${fonte}, ${largura}px ${caminho}`);
      }
    }
  }
  console.log("OK: alvos de toque com pelo menos 44 × 44 px em 375 e 320 px, com a fonte da web e com a de reserva");

  // A área de toque ampliada não pode levar o anel de foco para cima do texto vizinho.
  for (const [fonte, aba] of [["web", page], ["reserva", semFonte]]) {
    await aba.setViewportSize({ width: 375, height: 800 });
    for (const [caminho, seletor, vizinhos] of [["/projetos", ".e-project-card h2 a", [".e-project-card > p"]], ["/tarefas/1", ".e-read-project > a", [".e-read-title", ".e-read-tags"]]]) {
      await prepararFonte(aba, fonte, caminho);
      const sobreposto = await aba.evaluate(([seletor, vizinhos]) => {
        const link = document.querySelector(seletor);
        link.focus({ focusVisible: true });
        const estilo = getComputedStyle(link);
        const margem = parseFloat(estilo.outlineOffset) + parseFloat(estilo.outlineWidth);
        const caixa = link.getBoundingClientRect();
        const anel = { top: caixa.top - margem, bottom: caixa.bottom + margem };
        return vizinhos.map((vizinho) => [vizinho, link.closest("article, section").querySelector(vizinho).getBoundingClientRect()])
          .filter(([, outro]) => anel.bottom > outro.top + 0.5 && anel.top < outro.bottom - 0.5).map(([vizinho]) => vizinho);
      }, [seletor, vizinhos]);
      assert.deepEqual(sobreposto, [], `fonte ${fonte}, ${caminho}: o anel de foco de ${seletor} cobre o texto vizinho`);
    }
  }
  await semFonte.close();
  console.log("OK: o anel de foco dos links ampliados não cobre o texto vizinho, com a fonte da web e com a de reserva");

  // Ficha pelo teclado: Enter no título abre os detalhes e Esc fecha, devolvendo o foco ao link de origem.
  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, "/");
  const link = page.getByRole("link", { name: "Criar o repositório", exact: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(`${web}/tarefas/1`);
  await page.locator(".e-form-overlay").getByRole("heading", { name: "Criar o repositório" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForURL(`${web}/`);
  await page.waitForFunction(() => document.activeElement?.textContent === "Criar o repositório");
  console.log("OK: Enter abre a ficha e Esc fecha devolvendo o foco ao link");

  assert.deepEqual(errosPagina, []);
  assert.equal(await readFile(join(raiz, "db.json"), "utf8"), bancoOriginal);
  assert.equal(await readFile(join(raiz, "db.seed.json"), "utf8"), seedOriginal);
  console.log("OK: sem erros JavaScript e bancos locais preservados");
}

executar()
  .catch((erro) => { console.error(erro); process.exitCode = 1; })
  .finally(async () => {
    await browser?.close().catch(() => {});
    for (const processo of processos) {
      if (processo.exitCode === null && processo.signalCode === null) {
        const encerrado = new Promise((resolve) => processo.once("exit", resolve));
        processo.kill();
        await encerrado;
      }
    }
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });
