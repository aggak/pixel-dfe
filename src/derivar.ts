import type { Prioridade, Status, Tarefa } from "./tipos";

export const STATUS: Status[] = ["a-fazer", "em-andamento", "em-revisao", "concluida"];

export type Filtros = { busca: string; status: Status | "todos"; prioridade: Prioridade | "todas" };
export const filtrosIniciais: Filtros = { busca: "", status: "todos", prioridade: "todas" };

// Regra única de busca e filtros: qualquer visão de tarefas deve passar por aqui.
export function filtrarTarefas(tarefas: Tarefa[], { busca, status, prioridade }: Filtros) {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return tarefas.filter((tarefa) =>
    tarefa.titulo.toLocaleLowerCase("pt-BR").includes(termo) &&
    (status === "todos" || tarefa.status === status) &&
    (prioridade === "todas" || tarefa.prioridade === prioridade),
  );
}

// Parte da lista fixa de status para que uma coluna sem tarefas continue no quadro.
export function agruparPorStatus(tarefas: Tarefa[]) {
  return STATUS.map((status) => ({ status, tarefas: tarefas.filter((tarefa) => tarefa.status === status) }));
}
