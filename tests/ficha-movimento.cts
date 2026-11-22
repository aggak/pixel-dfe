const assert = require("node:assert/strict");
const { homedir } = require("node:os");
const { join } = require("node:path");
const { webkit } = require("playwright");
const { criarApoio } = require("./apoio.cts");

const apoio = criarApoio();

async function executar() {
  const { banco } = await apoio.criarBanco();
  const { web } = await apoio.subirAmbiente({ banco });
  const browser = await apoio.abrirNavegador();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await page.route("**/*", (rota) => {
    const url = new URL(rota.request().url());
    return url.hostname === "127.0.0.1" ? rota.continue() : rota.abort();
  });
  await page.goto(`${web}/tarefas/nova`, {
    waitUntil: "domcontentloaded",
  });
  const ficha = page.locator(".e-form-modal");
  const cabecalho = page.locator(".e-form-header");
  await page.locator("form").waitFor();
  const antes = await ficha.boundingBox();
  const alvo = await cabecalho.boundingBox();
  await page.mouse.move(alvo.x + 80, alvo.y + 20);
  await page.mouse.down();
  await page.mouse.move(alvo.x - 120, alvo.y + 100, { steps: 8 });
  await page.mouse.up();
  const depois = await ficha.boundingBox();
  assert.ok(Math.abs(depois.x - antes.x + 200) < 2);
  assert.ok(Math.abs(depois.y - antes.y - 80) < 2);
  await cabecalho.focus();
  await page.keyboard.press("ArrowLeft");
  const teclado = await ficha.boundingBox();
  assert.ok(Math.abs(teclado.x - depois.x + 10) < 2);
  await page.keyboard.press("Shift+ArrowUp");
  const cima = await ficha.boundingBox();
  assert.ok(Math.abs(cima.y - teclado.y + 40) < 2);
  const inicio = await cabecalho.boundingBox();
  await page.mouse.move(inicio.x + 80, inicio.y + 20);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 8 });
  await page.mouse.up();
  const limite = await ficha.boundingBox();
  assert.ok(limite.x >= 7 && limite.y >= 7);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForFunction(() => {
    const caixa = document
      .querySelector(".e-form-modal")
      .getBoundingClientRect();
    return caixa.left >= 7 && caixa.right <= innerWidth - 7;
  });
  await page.getByRole("button", { name: "Fechar nova tarefa" }).click();
  await ficha.waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/");
  console.log("OK: arraste, teclado, limites, resize e fechamento da ficha");
  await fecharLogoNoWebkit(web);
}

async function fecharLogoNoWebkit(web) {
  const compat = join(homedir(), ".cache/ms-playwright/compat-ubuntu-noble");
  let browser;
  try {
    browser = apoio.registrar(
      await webkit.launch({
        headless: true,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: [compat, process.env.LD_LIBRARY_PATH]
            .filter(Boolean)
            .join(":"),
        },
      }),
    );
  } catch (erro) {
    console.warn(
      `AVISO: WebKit não abriu; caso de fechar logo depois de abrir pulado (${String(erro.message).split("\n")[0]})`,
    );
    return;
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(5000);
  await page.route("**/*", (rota) => {
    const url = new URL(rota.request().url());
    return url.hostname === "127.0.0.1" ? rota.continue() : rota.abort();
  });
  await page.goto(web, { waitUntil: "domcontentloaded" });
  await page.locator(".e-task-title").first().click();
  await page.locator(".e-form-modal").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".e-form-overlay").waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/");
  await page.locator(".e-task-menu").first().click();
  await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
  await page.locator(".e-confirm-dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".e-confirm-overlay").waitFor({ state: "detached" });
  await page.getByRole("link", { name: "Projetos", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/projetos");
  console.log("OK: WebKit fecha ficha e confirmação logo depois de abrir");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
