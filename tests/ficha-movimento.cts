const assert = require("node:assert/strict");
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
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
