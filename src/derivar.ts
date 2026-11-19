import type { Prioridade, Status, Tarefa } from "./tipos";

export interface Filtros {
  busca: string;
  status: Status | "todos";
  prioridade: Prioridade | "todas";
}

export const FILTROS_INICIAIS: Filtros = {
  busca: "",
  status: "todos",
  prioridade: "todas",
};

const comparavel = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

export function filtrarTarefas(tarefas: Tarefa[], f: Filtros): Tarefa[] {
  const termo = comparavel(f.busca.trim());
  return tarefas.filter(
    (t) =>
      comparavel(t.titulo).includes(termo) &&
      (f.status === "todos" || t.status === f.status) &&
      (f.prioridade === "todas" || t.prioridade === f.prioridade),
  );
}

export const STATUS: Status[] = [
  "a-fazer",
  "em-andamento",
  "em-revisao",
  "concluida",
];

interface ColunaStatus {
  status: Status;
  tarefas: Tarefa[];
}

export function agruparPorStatus(tarefas: Tarefa[]): ColunaStatus[] {
  return STATUS.map((status) => ({
    status,
    tarefas: tarefas.filter((t) => t.status === status),
  }));
}
