// Issue #54: abre e recarrega as rotas na aplicação publicada, sem gravar na API.
// Execução sob demanda porque depende dos serviços hospedados.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { lancarNavegador } = require("./ui.cjs");

const APP = "https://pixel-dfe-project.up.railway.app";
const API = "https://pixel-dfe-production.up.railway.app";

async function ler(caminho) {
  const resposta = await fetch(`${API}${caminho}`, { cache: "no-store" });
  assert.equal(resposta.status, 200, `API: GET ${caminho}`);
  return resposta.json();
}

async function executar() {
  const [tarefa, projetos] = await Promise.all([ler("/tarefas/2"), ler("/projetos")]);
  const projeto = projetos.find((item) => String(item.id) === String(tarefa.projetoId)) ?? projetos[0];
  assert.ok(projeto, "A API publicada não tem projetos para conferir as rotas.");
  const idProjeto = encodeURIComponent(projeto.id);
  const rotas = [
    ["/", (page) => page.getByRole("region", { name: "Lista de tarefas" }).locator("[data-task-id]").first()],
    ["/quadro", (page) => page.getByRole("region", { name: "Quadro de tarefas por status" }).locator("[data-task-id]").first()],
    ["/projetos", (page) => page.locator("main").getByRole("link", { name: projeto.nome, exact: true })],
    [`/projetos/${idProjeto}`, (page) => page.getByRole("heading", { level: 1, name: projeto.nome, exact: true })],
    ["/tarefas/2", (page) => page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true }).getByRole("heading", { name: tarefa.titulo, exact: true })],
    ["/tarefas/nova", (page) => page.getByRole("dialog", { name: "Nova tarefa", exact: true }).locator("form")],
    ["/tarefas/2/editar", (page) => page.getByRole("dialog", { name: "Editar tarefa", exact: true }).getByLabel(/^Título\s*\*?$/)],
    ["/projetos/novo", (page) => page.getByRole("dialog", { name: "Novo projeto", exact: true }).locator("form")],
    [`/projetos/${idProjeto}/editar`, (page) => page.getByRole("dialog", { name: "Editar projeto", exact: true }).getByLabel(/^Nome\s*\*?$/)],
    ["/rota-inexistente", (page) => page.getByRole("heading", { level: 1, name: "Página não encontrada", exact: true })],
  ];

  const browser = await lancarNavegador();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(20000);
    const erros = [];
    page.on("pageerror", (erro) => erros.push(erro.message));

    for (const [caminho, elemento] of rotas) {
      for (const acao of ["acesso direto", "recarga"]) {
        const resposta = acao === "acesso direto" ? await page.goto(`${APP}${caminho}`) : await page.reload();
        assert.equal(resposta.status(), 200, `${acao}: ${caminho} devolveu erro da hospedagem`);
        assert.match(resposta.headers()["content-type"] ?? "", /text\/html/, `${acao}: ${caminho} não recebeu o HTML da aplicação`);
        assert.equal(new URL(page.url()).pathname, caminho, `${acao}: ${caminho} redirecionou para outra rota`);
        await elemento(page).waitFor({ state: "visible" });
      }
      console.log(`OK: ${caminho} abre diretamente e continua funcionando após recarregar`);
    }

    assert.deepEqual(erros, [], `Erros JavaScript: ${erros.join("; ")}`);
    console.log(`OK: ${rotas.length} rotas verificadas no navegador, sem erro JavaScript nem escrita na API`);
  } finally {
    await browser.close();
  }
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
