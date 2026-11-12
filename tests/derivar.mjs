import assert from "node:assert/strict";
import { filtrarTarefas } from "../src/derivar.ts";

const titulos = [
  "Redigir o relatório de requisitos",
  "Publicar o protótipo navegável",
  "Consumir a API de empréstimos",
  "Exportar o script de migração",
  "Revisar a avaliação dos alunos",
  "Testar  a\tAPI   do monitoramento",
  "RELATORIO FINAL",
];
const tarefas = titulos.map((titulo, indice) => ({ id: String(indice + 1), projetoId: "1", titulo, descricao: "", status: indice % 2 ? "concluida" : "a-fazer", prioridade: "media", responsavel: "", prazo: "" }));
const achados = (busca, filtros = {}) => filtrarTarefas(tarefas, { busca, status: "todos", prioridade: "todas", ...filtros }).map((tarefa) => tarefa.titulo);

const casos = [
  ["relatório", [titulos[0], titulos[6]]],
  ["relatorio", [titulos[0], titulos[6]]],
  ["RELATÓRIO", [titulos[0], titulos[6]]],
  ["relatório", [titulos[0], titulos[6]]],
  ["prototipo", [titulos[1]]],
  ["protótipo navegavel", [titulos[1]]],
  ["emprestimos", [titulos[2]]],
  ["api  de", [titulos[2]]],
  ["  api de  ", [titulos[2]]],
  ["api\tde", [titulos[2]]],
  ["migracao", [titulos[3]]],
  ["migração", [titulos[3]]],
  ["avaliacao", [titulos[4]]],
  ["avaliação", [titulos[4]]],
  ["a api do", [titulos[5]]],
  ["testar a", [titulos[5]]],
  ["mígrãçáo", [titulos[3]]],
  ["relatorios", []],
  ["apide", []],
  ["", titulos],
  ["   ", titulos],
];

for (const [busca, esperado] of casos) assert.deepEqual(achados(busca), esperado, JSON.stringify(busca));
assert.deepEqual(achados("relatorio", { status: "a-fazer" }), [titulos[0], titulos[6]]);
assert.deepEqual(achados("relatorio", { status: "concluida" }), []);
assert.deepEqual(achados("prototipo", { status: "concluida", prioridade: "media" }), [titulos[1]]);
assert.deepEqual(achados("prototipo", { prioridade: "alta" }), []);
assert.deepEqual(tarefas.map((tarefa) => tarefa.titulo), titulos);
console.log("OK: a busca ignora acentos, maiúsculas e espaços repetidos nos dois lados e continua combinando com os filtros");
