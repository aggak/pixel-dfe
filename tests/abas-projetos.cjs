const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { createServer } = require("node:net");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const processos = [];
const portasUsadas = new Set();
let browser;
let temporario;

async function portaLivre() {
  for (;;) {
    const servidor = createServer();
    await new Promise((resolve, reject) => {
      servidor.once("error", reject);
      servidor.listen(0, "127.0.0.1", resolve);
    });
    const porta = servidor.address().port;
    await new Promise((resolve) => servidor.close(resolve));
    if (!portasUsadas.has(porta)) {
      portasUsadas.add(porta);
      return porta;
    }
  }
}

async function esperar(url) {
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (processos.some((processo) => processo.exitCode !== null || processo.signalCode !== null)) throw new Error("Servidor encerrou antes do teste.");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
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

async function executar() {
  const bancoOriginal = await readFile(join(raiz, "db.json"), "utf8");
  const seedOriginal = await readFile(join(raiz, "db.seed.json"), "utf8");
  temporario = await mkdtemp(join(raiz, ".testes-abas-"));
  const banco = join(temporario, "db.json");
  await copyFile(join(raiz, "db.json"), banco);
  const dados = JSON.parse(await readFile(banco, "utf8"));
  for (let numero = 1; numero <= 12; numero++) dados.projetos.push({
    id: `teste-abas-${numero}`, nome: `Projeto de teste ${numero}`, descricao: "", disciplina: "Testes", criadoEm: "2026-11-12",
  });
  await writeFile(banco, JSON.stringify(dados));
  const ultimo = dados.projetos.at(-1);
  const portaApi = await portaLivre();
  const portaWeb = await portaLivre();
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar("node_modules/vite/bin/vite.js", ["--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([esperar(`${api}/projetos`), esperar(web)]);
  assert.deepEqual((await (await fetch(`${api}/projetos`)).json()).map((projeto) => projeto.id), dados.projetos.map((projeto) => projeto.id));

  browser = await lancarNavegador();
  const page = await browser.newPage({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errosPagina = [];
  page.on("pageerror", (erro) => errosPagina.push(erro.message));
  const abas = page.getByRole("navigation", { name: "Projetos", exact: true });
  const todas = abas.getByRole("link", { name: "Todas", exact: true });
  const setaInicio = abas.locator('button[data-lado="ini"]');
  const setaFim = abas.locator('button[data-lado="fim"]');

  async function abrir(caminho) {
    await page.goto(`${web}${caminho}`);
    await page.waitForFunction((total) => document.querySelectorAll(".e-tabs a").length === total + 1, dados.projetos.length);
    await page.evaluate(() => document.fonts.ready);
  }

  async function sobra(esperado) {
    await page.waitForFunction((valor) => document.querySelector(".e-tabs")?.dataset.sobra === valor, esperado);
    assert.equal(await abas.getAttribute("data-sobra"), esperado);
  }

  async function clicarSeta(seta) {
    const caixa = await seta.boundingBox();
    assert.ok(caixa, "a seta tem uma área visível para o clique");
    await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  }

  async function conferirFaixa() {
    const medida = await abas.evaluate((nav) => {
      const faixa = nav.getBoundingClientRect();
      const fixa = nav.querySelector("a").getBoundingClientRect();
      return {
        transborda: nav.scrollWidth > nav.clientWidth,
        larguraPagina: document.documentElement.scrollWidth,
        larguraTela: document.documentElement.clientWidth,
        inicio: faixa.left, fim: faixa.right, inicioTodas: fixa.left, fimTodas: fixa.right,
        rolagemPagina: window.scrollX,
      };
    });
    assert.equal(medida.transborda, true, "há projetos fora da faixa visível");
    assert.ok(medida.larguraPagina <= medida.larguraTela + 1, "só as abas podem rolar horizontalmente");
    assert.equal(medida.rolagemPagina, 0, "a página não acompanha a rolagem das abas");
    assert.ok(medida.inicio >= 0 && medida.fim <= medida.larguraTela + 1, "a faixa cabe na tela");
    assert.ok(Math.abs(medida.inicioTodas - medida.inicio) <= 1, "Todas permanece presa à esquerda");
    assert.ok(medida.fimTodas <= medida.fim, "Todas permanece inteira dentro da faixa");
  }

  async function conferirAtual() {
    await page.waitForFunction((id) => {
      const nav = document.querySelector(".e-tabs");
      const atual = nav?.querySelector("a[aria-current]");
      if (!atual || atual.getAttribute("href") !== `/projetos/${id}`) return false;
      const caixa = atual.getBoundingClientRect();
      return caixa.left >= nav.querySelector("a").getBoundingClientRect().right - 1 && caixa.right <= nav.getBoundingClientRect().right + 1;
    }, ultimo.id);
    assert.equal(await abas.getByRole("link", { name: ultimo.nome, exact: true }).getAttribute("aria-current"), "page");
    assert.ok(await abas.evaluate((nav) => nav.scrollLeft > 0), "abrir a última aba desloca a faixa");
    await conferirFaixa();
  }

  await abrir("/");
  await sobra("fim");
  assert.equal(await todas.getAttribute("aria-current"), "page");
  assert.equal(await abas.evaluate((nav) => nav.scrollLeft), 0);
  assert.equal(await setaInicio.isVisible(), false);
  assert.equal(await setaFim.isVisible(), false);
  await conferirFaixa();
  console.log("OK: em 375 px, a faixa transborda por dentro, indica fim e mantém Todas à esquerda");

  await abas.hover();
  await page.mouse.wheel(240, 0);
  await sobra("ini fim");
  assert.ok(await abas.evaluate((nav) => nav.scrollLeft > 0), "o gesto horizontal desloca as abas");
  await conferirFaixa();
  await abas.evaluate((nav) => nav.scrollTo({ left: nav.scrollWidth, behavior: "instant" }));
  await sobra("ini");
  assert.ok(await abas.evaluate((nav) => Math.abs(nav.scrollWidth - nav.clientWidth - nav.scrollLeft) <= 1));
  await conferirFaixa();
  await abas.evaluate((nav) => nav.scrollTo({ left: 0, behavior: "instant" }));
  await sobra("fim");
  await conferirFaixa();
  console.log("OK: início, meio e fim atualizam data-sobra, com Todas fixa durante a rolagem");

  await abrir(`/projetos/${ultimo.id}`);
  await page.getByRole("heading", { name: ultimo.nome, exact: true }).waitFor();
  await conferirAtual();
  await sobra("ini");
  console.log("OK: abrir diretamente o último projeto em 375 px traz a aba ativa inteira para a vista");

  await page.setViewportSize({ width: 1280, height: 900 });
  await conferirAtual();
  await sobra("ini");
  assert.equal(await setaInicio.isVisible(), true);
  assert.equal(await setaFim.isVisible(), false);
  console.log("OK: redimensionar preserva a aba ativa visível e atualiza as setas");

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
  assert.ok(retorno < depois && retorno <= 2, `a seta do início retorna ao começo (${depois} → ${retorno} px)`);
  assert.equal(await setaInicio.isVisible(), false);
  await conferirFaixa();
  console.log(`OK: em desktop, as duas setas rolam a faixa e somem no limite correspondente (${depois} → ${retorno} px)`);

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
