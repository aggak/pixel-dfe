// Issue #53: verificação sob demanda da aplicação publicada (fora da lista offline do
// validate-delivery.mjs, como tests/auditoria-lighthouse.mjs). Confere o README e, ao vivo,
// o frontend da Railway integrado à API hospedada. A API pública aceita escrita sem
// autenticação: o script só cria, muda e exclui uma tarefa própria, identificada pelo
// título, e no `finally` apaga qualquer sobra dela antes de comparar o estado final.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { comTextos, criarUi, escapar, lancarNavegador, TEXTO_STATUS } = require("./ui.cjs");

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = "https://pixel-dfe-project.up.railway.app";
const API = "https://pixel-dfe-production.up.railway.app";
const EQUIPE = ["Gabriela de Araújo Reis", "Euclides Carlos Pilon Neto", "Linnek Lima de Araujo"];

async function lerApi(caminho) {
  const resposta = await fetch(`${API}${caminho}`, { cache: "no-store" });
  assert.equal(resposta.status, 200, `GET ${caminho}`);
  return resposta.json();
}

// 1. README: link clicável logo após o parágrafo de apresentação, sem perder nada da versão da main.
async function conferirReadme() {
  const readme = await readFile(join(raiz, "README.md"), "utf8");
  const linhas = readme.split(/\r?\n/);
  const posLink = linhas.findIndex((linha) => new RegExp(`\\]\\(${escapar(APP)}/?\\)`).test(linha));
  assert.ok(posLink >= 0, `README.md sem link clicável para ${APP}`);
  const posApresentacao = linhas.findIndex((linha) => linha.startsWith("Organize projetos e tarefas"));
  const posImagem = linhas.findIndex((linha) => linha.startsWith("!["));
  assert.ok(posApresentacao >= 0 && posApresentacao < posLink && posLink < posImagem, "o link deve ficar entre o parágrafo inicial e a primeira captura");
  for (const trecho of ["## Como rodar", "**Framework:** React com TypeScript.", "## Equipe", "**Desenvolvimento Frontend**, ULBRA — 2026.2", ...EQUIPE.map((nome) => `- ${nome}`), "[Créditos e licenças](public/design-licenses/THIRD_PARTY_NOTICES.txt)"]) {
    assert.ok(readme.includes(trecho), `README.md perdeu: ${trecho}`);
  }
  // Toda linha do README da main continua presente, na mesma ordem (imagens, detalhes, comandos).
  const original = execFileSync("git", ["show", "main:README.md"], { cwd: raiz, encoding: "utf8" }).split(/\r?\n/);
  let cursor = 0;
  for (const linha of original) {
    const achada = linhas.indexOf(linha, cursor);
    assert.ok(achada >= 0, `README.md perdeu ou reordenou a linha: ${JSON.stringify(linha)}`);
    cursor = achada + 1;
  }
  console.log(`OK: README.md tem o link ${APP} após a apresentação e preserva as ${original.length} linhas da main, a equipe e as licenças`);
}

// 2. Aplicação publicada integrada à API hospedada, com um ciclo de escrita próprio.
async function conferirPublicacao() {
  const tarefasIniciais = await lerApi("/tarefas");
  const projetos = await lerApi("/projetos");
  assert.ok(tarefasIniciais.length > 0 && projetos.length > 0, "API hospedada sem dados de exemplo");
  const titulo = `Verificação da publicação #53 ${new Date().toISOString()}`;
  const projeto = projetos[0];
  const temporaria = { projetoId: projeto.id, titulo, descricao: "Tarefa temporária criada e excluída por tests/verificar-publicacao.mjs", status: "a-fazer", prioridade: "baixa", responsavel: "Verificação automática", prazo: "2026-11-10" };
  console.log(`OK: estado inicial da API hospedada: ${tarefasIniciais.length} tarefas e ${projetos.length} projetos`);

  const browser = await lancarNavegador();
  const errosPagina = [];
  const locais = [];
  const respostasApi = [];
  let falha;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(20000);
    page.on("pageerror", (erro) => errosPagina.push(erro.message));
    page.on("request", (requisicao) => {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(requisicao.url())) locais.push(requisicao.url());
    });
    page.on("response", (resposta) => {
      if (resposta.url().startsWith(`${API}/`)) respostasApi.push(`${resposta.request().method()} ${resposta.url().slice(API.length)} ${resposta.status()}`);
    });
    const caminho = () => new URL(page.url()).pathname;
    const lista = page.getByRole("region", { name: "Lista de tarefas" });
    const quadro = page.getByRole("region", { name: "Quadro de tarefas por status" });
    const rodape = page.locator(".e-sheet-footer");
    const textoTotal = (n) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;

    // Leitura e navegação pelo menu.
    await page.goto(`${APP}/`);
    await lista.getByRole("link", { name: tarefasIniciais[0].titulo, exact: true }).waitFor();
    assert.equal(await lista.locator("[data-task-id]").count(), tarefasIniciais.length);
    assert.ok(respostasApi.includes("GET /tarefas 200"), respostasApi.join(", "));
    assert.ok(respostasApi.includes("GET /projetos 200"), respostasApi.join(", "));
    await page.getByRole("navigation", { name: "Visualização das tarefas" }).getByRole("link", { name: "Quadro", exact: true }).click();
    await quadro.locator("[data-task-id]").first().waitFor();
    assert.equal(caminho(), "/quadro");
    assert.equal(await quadro.locator("[data-task-id]").count(), tarefasIniciais.length);
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Projetos", exact: true }).click();
    await page.locator("main").getByRole("link", { name: projeto.nome, exact: true }).waitFor();
    assert.equal(caminho(), "/projetos");
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Tarefas", exact: true }).click();
    await lista.getByRole("link", { name: tarefasIniciais[0].titulo, exact: true }).waitFor();
    assert.equal(caminho(), "/");
    console.log(`OK: ${APP} lê GET /tarefas e /projetos com 200 da API hospedada e navega por /, /quadro e /projetos`);

    // Criação pela ficha publicada.
    const ui = criarUi(page);
    await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
    await page.getByRole("dialog", { name: "Nova tarefa", exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector(".e-form-overlay form"));
    const limite = Date.now() + 20000;
    while (!(await ui.projetosCarregados(projetos.length))) {
      if (Date.now() > limite) throw new Error("Os projetos não carregaram na ficha Nova tarefa.");
      await page.waitForTimeout(100);
    }
    await ui.preencherTarefa(comTextos(temporaria, projetos));
    const respostaPost = page.waitForResponse((r) => r.url() === `${API}/tarefas` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Salvar tarefa", exact: true }).click();
    const post = await respostaPost;
    assert.equal(post.status(), 201);
    const criada = await post.json();
    await page.waitForURL((url) => url.pathname === "/");
    await lista.getByRole("link", { name: titulo, exact: true }).waitFor();
    assert.equal(await rodape.innerText(), textoTotal(tarefasIniciais.length + 1));
    assert.deepEqual(await lerApi(`/tarefas/${encodeURIComponent(criada.id)}`), { id: criada.id, ...temporaria });
    console.log(`OK: a ficha publicada cria a tarefa temporária ${criada.id} e a API hospedada a devolve com os sete campos`);

    // Mudança de status pelo selo do cartão, persistida após recarregar.
    await page.goto(`${APP}/quadro`);
    const cartao = page.locator(`[data-task-id="${criada.id}"]`);
    await cartao.waitFor();
    const respostaPatch = page.waitForResponse((r) => r.url() === `${API}/tarefas/${encodeURIComponent(criada.id)}` && r.request().method() === "PATCH");
    await page.getByRole("button", { name: new RegExp(`^Mudar status de ${escapar(titulo)} \\(atual:`) }).click();
    await page.getByRole("menu", { name: new RegExp(`^Mudar status de ${escapar(titulo)}`) }).getByRole("menuitemradio", { name: TEXTO_STATUS["em-andamento"], exact: true }).click();
    assert.equal((await respostaPatch).status(), 200);
    await page.locator(`[data-status-column="em-andamento"] [data-task-id="${criada.id}"]`).waitFor();
    assert.equal((await lerApi(`/tarefas/${encodeURIComponent(criada.id)}`)).status, "em-andamento");
    await page.reload();
    await page.locator(`[data-status-column="em-andamento"] [data-task-id="${criada.id}"]`).waitFor();
    console.log("OK: o selo do cartão muda o status para Em andamento, a API hospedada grava e o quadro mantém após recarregar");

    // Exclusão pela interface, com confirmação.
    const dialogo = page.getByRole("dialog", { name: `Excluir ${titulo}` });
    await cartao.getByRole("button", { name: `Ações de ${titulo}` }).click();
    await page.getByRole("menuitem", { name: "Excluir tarefa" }).click();
    await dialogo.waitFor();
    const respostaDelete = page.waitForResponse((r) => r.url() === `${API}/tarefas/${encodeURIComponent(criada.id)}` && r.request().method() === "DELETE");
    await dialogo.getByRole("button", { name: "Excluir tarefa" }).click();
    assert.equal((await respostaDelete).status(), 200);
    await cartao.waitFor({ state: "detached" });
    assert.equal(await rodape.innerText(), textoTotal(tarefasIniciais.length));
    assert.equal((await fetch(`${API}/tarefas/${encodeURIComponent(criada.id)}`, { cache: "no-store" })).status, 404);
    console.log("OK: a exclusão confirmada pela interface remove a tarefa temporária da API hospedada");

    assert.deepEqual(locais, []);
    assert.deepEqual(errosPagina, []);
    console.log("OK: nenhuma chamada a localhost e nenhum erro JavaScript na aplicação publicada");
  } catch (erro) {
    falha = erro;
  } finally {
    await browser.close().catch(() => {});
    // Limpeza defensiva: remove qualquer tarefa com o título desta execução que tenha sobrado.
    const sobras = (await lerApi("/tarefas")).filter((tarefa) => tarefa.titulo === titulo);
    for (const tarefa of sobras) {
      const resposta = await fetch(`${API}/tarefas/${encodeURIComponent(tarefa.id)}`, { method: "DELETE" });
      console.warn(`Aviso: limpeza defensiva removeu a tarefa ${tarefa.id} (HTTP ${resposta.status}).`);
    }
  }

  // Estado final idêntico ao inicial: mesmos IDs e nenhuma tarefa pré-existente alterada.
  // Se o ciclo já falhou, essa falha é a que importa; a do estado final só é mostrada.
  try {
    const tarefasFinais = await lerApi("/tarefas");
    assert.deepEqual(tarefasFinais.map((t) => t.id), tarefasIniciais.map((t) => t.id));
    assert.deepEqual(tarefasFinais, tarefasIniciais);
    assert.deepEqual(await lerApi("/projetos"), projetos);
    console.log(`OK: a API hospedada voltou às mesmas ${tarefasIniciais.length} tarefas e ${projetos.length} projetos do início, sem alterações`);
  } catch (erro) {
    if (!falha) throw erro;
    console.error(erro);
  }
  if (falha) throw falha;
}

try {
  await conferirReadme();
  await conferirPublicacao();
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
}
