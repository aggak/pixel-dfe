import type { Prioridade, Status, Tarefa } from "./tipos";

// Tipos da tela: ficam fora de tipos.ts para não alterar o contrato de dados.
export interface Filtros {
  busca: string;
  status: Status | "todos";
  prioridade: Prioridade | "todas";
}

export const FILTROS_INICIAIS: Filtros = { busca: "", status: "todos", prioridade: "todas" };

export function filtrarTarefas(tarefas: Tarefa[], f: Filtros): Tarefa[] {
  const termo = f.busca.trim().toLocaleLowerCase("pt-BR");
  return tarefas.filter(
    (t) =>
      t.titulo.toLocaleLowerCase("pt-BR").includes(termo) &&
      (f.status === "todos" || t.status === f.status) &&
      (f.prioridade === "todas" || t.prioridade === f.prioridade),
  );
}

// Lista fixa na ordem do contrato: o quadro mantém as quatro colunas mesmo vazias (Object.groupBy as perderia).
export const STATUS: Status[] = ["a-fazer", "em-andamento", "em-revisao", "concluida"];

export interface ColunaStatus {
  status: Status;
  tarefas: Tarefa[];
}

export function agruparPorStatus(tarefas: Tarefa[]): ColunaStatus[] {
  return STATUS.map((status) => ({ status, tarefas: tarefas.filter((t) => t.status === status) }));
}
