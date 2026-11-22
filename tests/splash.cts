const assert = require("node:assert/strict");

const { criarApoio } = require("./apoio.cts");
const apoio = criarApoio();

async function executar() {
  const { banco } = await apoio.criarBanco({ prefixo: "pixel-splash-" });
  const { web } = await apoio.subirAmbiente({
    banco,
    tentativas: 300,
    env: { ...process.env, VITE_SPLASH: "ligado" },
  });
  const browser = await apoio.abrirNavegador();
  const contexto = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await contexto.newPage();
  const errosJs = [];
  page.on("pageerror", (erro) => errosJs.push(erro));
  page.setDefaultTimeout(10000);
  const splash = page.locator(".e-splash");
  const raizInerte = () =>
    page.evaluate(() => document.getElementById("root").inert);

  await page.goto(`${web}/`);
  await splash.waitFor();
  const inicio = Date.now();
  assert.equal(await splash.getAttribute("aria-hidden"), "true");
  assert.equal(await raizInerte(), true);
  console.log("OK: splash aparece na entrada e deixa a página inerte");

  const botao = page.locator('[data-action="new-task"]');
  await botao.waitFor({ state: "attached" });
  const caixa = await botao.boundingBox();
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.locator(".e-form-overlay").count(), 0);
  console.log("OK: clique e teclado durante o splash não acionam a página");

  await page.waitForTimeout(Math.max(0, 2000 - (Date.now() - inicio)));
  assert.equal(await splash.isVisible(), true);
  await splash.waitFor({ state: "detached", timeout: 1500 });
  const duracao = Date.now() - inicio;
  assert.ok(duracao <= 3000, `splash durou ${duracao} ms`);
  assert.equal(await raizInerte(), false);
  console.log(`OK: splash some sozinho (~${duracao} ms) e libera a página`);

  await botao.click();
  await page.locator(".e-form-overlay").waitFor();
  console.log("OK: depois do splash a página responde ao clique");

  await page.goto(`${web}/quadro`);
  await page.locator(".e-card").first().waitFor();
  assert.equal(await splash.count(), 0);
  assert.equal(await raizInerte(), false);
  console.log("OK: splash não se repete na mesma sessão");

  const direto = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const paginaDireta = await direto.newPage();
  paginaDireta.on("pageerror", (erro) => errosJs.push(erro));
  paginaDireta.setDefaultTimeout(10000);
  const splashDireto = paginaDireta.locator(".e-splash");
  const fechar = paginaDireta.getByRole("button", {
    name: "Fechar detalhes da tarefa",
  });
  await paginaDireta.goto(`${web}/tarefas/2`);
  await splashDireto.waitFor();
  await paginaDireta.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Fechar detalhes da tarefa",
  );
  await paginaDireta.mouse.click(40, 120);
  await paginaDireta.keyboard.press("Escape");
  await paginaDireta.keyboard.press("Enter");
  await splashDireto.waitFor({ state: "detached", timeout: 4000 });
  assert.equal(new URL(paginaDireta.url()).pathname, "/tarefas/2");
  assert.equal(await paginaDireta.locator(".e-form-modal").count(), 1);
  assert.equal(
    await fechar.evaluate((botao) => botao === document.activeElement),
    true,
  );
  console.log("OK: clique e teclado durante o splash não fecham a ficha");

  await paginaDireta.keyboard.press("Escape");
  await paginaDireta.waitForURL(`${web}/`);
  await paginaDireta.locator(".e-form-modal").waitFor({ state: "detached" });
  await paginaDireta.goto(`${web}/tarefas/2`);
  await fechar.waitFor();
  await paginaDireta.mouse.click(40, 120);
  await paginaDireta.waitForURL(`${web}/`);
  await paginaDireta.goto(`${web}/tarefas/2`);
  await fechar.click();
  await paginaDireta.waitForURL(`${web}/`);
  await direto.close();
  console.log("OK: depois do splash a ficha fecha por Esc, clique fora e X");

  const reduzido = await browser.newContext({ reducedMotion: "reduce" });
  const paginaReduzida = await reduzido.newPage();
  await paginaReduzida.goto(`${web}/`);
  const splashReduzido = paginaReduzida.locator(".e-splash");
  await splashReduzido.waitFor();
  assert.equal(
    await splashReduzido.evaluate(
      (el) => el.getAnimations({ subtree: true }).length,
    ),
    0,
  );
  await splashReduzido.waitFor({ state: "detached", timeout: 4000 });
  console.log("OK: com movimento reduzido o splash aparece parado");

  assert.deepEqual(errosJs, []);
  console.log("Cenários do splash aprovados.");
}

executar()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => apoio.encerrar());
