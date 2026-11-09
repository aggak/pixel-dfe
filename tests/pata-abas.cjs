const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function pronto(url) {
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(processos, argumentos, env = process.env) {
  const processo = spawn(process.execPath, argumentos, { windowsHide: true, stdio: "pipe", env });
  processo.stdout.on("data", () => {});
  processo.stderr.on("data", (erro) => process.stderr.write(erro));
  processos.push(processo);
}

let browser;
let temporario;
const processos = [];

const contador = () => {
  window.__patas = 0;
  const conta = (no) => { if (no.nodeType === 1 && (no.matches(".e-pata") || no.querySelector(".e-pata"))) window.__patas++; };
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(conta))).observe(document, { childList: true, subtree: true });
};

async function executar() {
  temporario = await mkdtemp(join(tmpdir(), "pixel-pata-"));
  const originais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  await copyFile("db.seed.json", join(temporario, "db.json"));
  const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
  const api = `http://127.0.0.1:${portaApi}`;
  const web = `http://127.0.0.1:${portaWeb}`;
  iniciar(processos, ["node_modules/json-server/lib/bin.js", join(temporario, "db.json"), "--host", "127.0.0.1", "--port", String(portaApi)]);
  iniciar(processos, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"], { ...process.env, VITE_API_URL: api });
  await Promise.all([pronto(`${api}/tarefas`), pronto(web)]);

  browser = await lancarNavegador();
  const errosJs = [];
  const novaPagina = async (opcoes = {}) => {
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opcoes });
    const page = await contexto.newPage();
    page.on("pageerror", (erro) => errosJs.push(erro));
    page.setDefaultTimeout(10000);
    await page.addInitScript(contador);
    return page;
  };
  const page = await novaPagina();
  const ativa = page.locator('.e-tabs a[aria-current="page"]');
  const pata = page.locator(".e-tabs .e-pata");
  const patas = () => page.evaluate(() => window.__patas);
  const aba = (nome) => page.locator(".e-tabs").getByRole("link", { name: nome, exact: true });
  const ate = (url) => page.waitForURL((u) => u.pathname === url);
  const fim = async () => { await pata.first().waitFor({ state: "detached", timeout: 1500 }); };

  // 1. Primeira carga em "/": nenhuma pata.
  await page.goto(`${web}/`); await page.locator("main h1").waitFor(); await page.waitForTimeout(800);
  assert.equal(await patas(), 0);
  assert.equal(await pata.count(), 0);

  // 2. "Todas" -> projeto: a pata aparece na aba nova e some.
  await aba("Gerenciador de Tarefas").click();
  await pata.waitFor({ state: "attached" });
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.notEqual(await ativa.getAttribute("data-puxada"), null);
  assert.equal(await pata.getAttribute("aria-hidden"), "true");
  assert.equal(await pata.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
  assert.equal(await ativa.getAttribute("aria-current"), "page");
  await aba("Gerenciador de Tarefas").waitFor();
  await fim();
  assert.equal(await ativa.getAttribute("data-puxada"), null);
  assert.equal(await patas(), 1);

  // 2b. Folga para o esticão: em repouso a aba fica onde sempre ficou, e durante a animação nunca sai da caixa de rolagem.
  const topos = () => page.evaluate(() => ({ aba: document.querySelector('.e-tabs a[aria-current="page"]').getBoundingClientRect().top, outra: document.querySelector('.e-tabs a:not([aria-current])').getBoundingClientRect().top, caixa: document.querySelector(".e-tabs").getBoundingClientRect().top }));
  const repouso = await topos();
  assert.equal(repouso.aba, repouso.outra);
  assert.ok(repouso.aba - repouso.caixa >= 5.9, "a caixa das abas tem folga no topo");
  const semFolga = async (largura) => {
    const p = await novaPagina({ viewport: { width: largura, height: 800 } });
    await p.goto(`${web}/`); await p.locator("main h1").waitFor();
    const ler = () => p.evaluate(() => [document.querySelector(".e-tabs a").getBoundingClientRect().top, document.querySelector("main").getBoundingClientRect().top]);
    const com = await ler();
    await p.addStyleTag({ content: ".e-tabs{padding-top:0!important;margin-top:0!important}" });
    assert.deepEqual(com, await ler(), `abas e página não se mexem com a folga (${largura}px)`);
  };
  await semFolga(1280); await semFolga(375);

  // 3. Projeto -> projeto (mesma página): anima de novo, na aba nova.
  const amostra = page.evaluate(() => new Promise((resolve) => {
    let menor = Infinity; const inicio = performance.now();
    const passo = () => {
      const a = document.querySelector('.e-tabs a[aria-current="page"]'); const c = document.querySelector(".e-tabs");
      if (a && c) menor = Math.min(menor, a.getBoundingClientRect().top - c.getBoundingClientRect().top);
      if (performance.now() - inicio < 1000) requestAnimationFrame(passo); else resolve(menor);
    };
    passo();
  }));
  await aba("Modelagem da Biblioteca").click();
  await pata.waitFor({ state: "attached" });
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.equal(await ativa.textContent(), "Modelagem da Biblioteca");
  assert.equal(await patas(), 2);
  await fim();
  assert.ok((await amostra) >= 0, `a aba esticada fica dentro da caixa de rolagem (menor distância: ${await amostra})`);
  assert.deepEqual(await topos(), repouso);

  // 4. Clique em outra aba durante a animação: navega, e no fim há no máximo uma pata, na aba ativa.
  await aba("Gerenciador de Tarefas").click();
  await pata.waitFor({ state: "attached" });
  await aba("Modelagem da Biblioteca").click();
  await ate("/projetos/2");
  await page.locator('.e-tabs a[aria-current="page"]', { hasText: "Modelagem da Biblioteca" }).waitFor();
  await pata.waitFor({ state: "attached" });
  assert.ok((await pata.count()) <= 1);
  assert.equal(await ativa.locator(".e-pata").count(), 1);
  assert.equal(await ativa.textContent(), "Modelagem da Biblioteca");
  await fim();
  assert.equal(await page.locator(".e-pata").count(), 0);
  assert.equal(await page.locator("[data-puxada]").count(), 0);

  // 5. Lista <-> Quadro em "/": nenhuma pata nova.
  await aba("Todas").click();
  await ate("/");
  await fim();
  const antes = await patas();
  await page.getByRole("link", { name: "Quadro", exact: true }).click();
  await ate("/quadro");
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: "Lista", exact: true }).click();
  await ate("/");
  await page.waitForTimeout(800);
  assert.equal(await patas(), antes);
  assert.equal(await page.locator(".e-pata").count(), 0);

  // 6. Movimento reduzido: nada.
  const reduzida = await novaPagina({ reducedMotion: "reduce" });
  await reduzida.goto(`${web}/`); await reduzida.locator("main h1").waitFor();
  await reduzida.locator(".e-tabs").getByRole("link", { name: "Gerenciador de Tarefas", exact: true }).click();
  await reduzida.waitForURL((u) => u.pathname === "/projetos/1");
  await reduzida.waitForTimeout(900);
  assert.equal(await reduzida.evaluate(() => window.__patas), 0);

  // 7. Tema escuro: a pata usa as cores escuras e se distingue da aba.
  const escura = await novaPagina({ colorScheme: "dark" });
  await escura.goto(`${web}/`); await escura.locator("main h1").waitFor();
  await escura.locator(".e-tabs").getByRole("link", { name: "Gerenciador de Tarefas", exact: true }).click();
  await escura.locator(".e-tabs .e-pata").waitFor({ state: "attached" });
  const cores = await escura.evaluate(() => ({
    corpo: getComputedStyle(document.querySelector(".e-pata .e-gato-corpo")).fill,
    aba: getComputedStyle(document.querySelector('.e-tabs a[aria-current="page"]')).backgroundColor,
    token: getComputedStyle(document.documentElement).getPropertyValue("--e-gato-corpo").trim(),
  }));
  assert.equal(cores.token, "#bb91ca");
  assert.equal(cores.corpo, "rgb(187, 145, 202)");
  assert.notEqual(cores.corpo, cores.aba);

  // 11. Em 1280 px com só os 2 projetos do seed: nenhuma seta.
  const setaDireita = (p) => p.getByRole("button", { name: "Mostrar projetos à direita" });
  const setaEsquerda = (p) => p.getByRole("button", { name: "Mostrar projetos à esquerda" });
  await page.goto(`${web}/`); await page.locator("main h1").waitFor(); await aba("Modelagem da Biblioteca").waitFor();
  assert.equal(await setaDireita(page).count(), 0);
  assert.equal(await setaEsquerda(page).count(), 0);

  // Barra estreita com muitos projetos (criados pela API, no banco temporário).
  for (let i = 1; i <= 8; i++) {
    const r = await fetch(`${api}/projetos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome: `Projeto extra ${i}` }) });
    assert.ok(r.ok);
  }
  const projetos = await (await fetch(`${api}/projetos`)).json();
  const ultimo = projetos[projetos.length - 1];
  const estreita = await novaPagina({ viewport: { width: 375, height: 800 } });
  await estreita.goto(`${web}/`); await estreita.locator("main h1").waitFor();
  const barra = estreita.locator("nav.e-tabs");
  const dentro = (seletor) => estreita.evaluate((s) => {
    const b = document.querySelector("nav.e-tabs").getBoundingClientRect(); const r = document.querySelector(s).getBoundingClientRect();
    return r.left >= b.left - 1 && r.right <= b.right + 1;
  }, seletor);

  // 8. Barra larga demais: só a seta da direita aparece.
  await setaDireita(estreita).waitFor();
  assert.equal(await setaEsquerda(estreita).count(), 0);
  assert.equal(await estreita.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "a página não rola na horizontal");
  const alvo = await setaDireita(estreita).boundingBox();
  assert.ok(alvo.width >= 44 && alvo.height >= 44, "alvo de toque de 44 px");
  assert.equal(await estreita.locator('nav.e-tabs button[aria-label^="Mostrar projetos"]').count(), 0, "as setas ficam fora do nav");

  // 9. Clicar avança: scrollLeft cresce, a seta da esquerda aparece e a última aba acaba à vista.
  const antesRolagem = await barra.evaluate((el) => el.scrollLeft);
  await setaDireita(estreita).click();
  await estreita.waitForFunction((a) => document.querySelector("nav.e-tabs").scrollLeft > a, antesRolagem);
  await setaEsquerda(estreita).waitFor();
  for (let i = 0; i < 20 && (await setaDireita(estreita).count()) > 0; i++) { await setaDireita(estreita).click(); await estreita.waitForTimeout(500); }
  assert.equal(await setaDireita(estreita).count(), 0);
  assert.equal(await dentro("nav.e-tabs a:last-of-type"), true, "a última aba fica dentro da barra");
  await setaEsquerda(estreita).click();
  await estreita.waitForFunction(() => document.querySelector("nav.e-tabs").scrollLeft < document.querySelector("nav.e-tabs").scrollWidth - document.querySelector("nav.e-tabs").clientWidth - 1);
  await setaDireita(estreita).waitFor();

  // 10. Abrir direto o último projeto: a aba ativa está inteira na barra e a pata é visível.
  const direta = await novaPagina({ viewport: { width: 375, height: 800 } });
  await direta.goto(`${web}/`); await direta.locator("main h1").waitFor();
  await direta.goto(`${web}/projetos/${ultimo.id}`);
  await direta.locator('.e-tabs a[aria-current="page"]').waitFor();
  await direta.waitForTimeout(300);
  const visivel = await direta.evaluate(() => {
    const b = document.querySelector("nav.e-tabs").getBoundingClientRect(); const a = document.querySelector('nav.e-tabs a[aria-current="page"]').getBoundingClientRect();
    const livre = [...document.querySelectorAll(".e-tabs-seta")].every((s) => { const r = s.getBoundingClientRect(); return a.right <= r.left || a.left >= r.right; });
    return livre && a.left >= b.left - 1 && a.right <= b.right + 1;
  });
  assert.equal(visivel, true, "a aba ativa fica inteira na barra");
  const viaTab = await novaPagina({ viewport: { width: 375, height: 800 } });
  await viaTab.goto(`${web}/`); await viaTab.locator("main h1").waitFor();
  await viaTab.locator(".e-tabs").getByRole("link", { name: "Projeto extra 8", exact: true }).click();
  const pataViva = viaTab.locator(".e-tabs .e-pata");
  await pataViva.waitFor({ state: "attached" });
  const [bp, bb] = [await pataViva.boundingBox(), await viaTab.locator("nav.e-tabs").boundingBox()];
  assert.ok(bp.x < bb.x + bb.width && bp.x + bp.width > bb.x, "a pata intersecta a barra");

  // 12. As setas não entram na ordem do Tab.
  await estreita.locator(".e-logo").focus();
  for (let i = 0; i < 25; i++) {
    await estreita.keyboard.press("Tab");
    const nome = await estreita.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    assert.ok(!nome.startsWith("Mostrar projetos"), "o Tab não para nas setas");
  }

  assert.deepEqual(errosJs, []);
  const finais = await Promise.all(["db.json", "db.seed.json", "src/tipos.ts"].map((arquivo) => readFile(arquivo, "utf8")));
  assert.deepEqual(finais, originais);
  console.log("12 cenários aprovados; nenhum erro JavaScript não tratado e bancos preservados.");
}

executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  for (const processo of processos) {
    if (processo.exitCode === null) {
      const terminou = new Promise((resolve) => processo.once("exit", resolve));
      processo.kill();
      await terminou;
    }
  }
  if (temporario) await rm(temporario, { recursive: true, force: true });
});
