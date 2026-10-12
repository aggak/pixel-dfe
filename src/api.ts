import type { Projeto, Tarefa } from "./tipos";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export class ErroApi extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Falha ao consultar a API (${status}).`);
    this.status = status;
  }
}

async function ler<T>(caminho: string, signal?: AbortSignal): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, { signal });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }

  return (await resposta.json()) as T;
}

export function listarTarefas(signal?: AbortSignal): Promise<Tarefa[]> {
  return ler<Tarefa[]>("/tarefas", signal);
}

export function listarProjetos(signal?: AbortSignal): Promise<Projeto[]> {
  return ler<Projeto[]>("/projetos", signal);
}

export function buscarTarefa(id: string, signal?: AbortSignal): Promise<Tarefa> {
  return ler<Tarefa>(`/tarefas/${encodeURIComponent(id)}`, signal);
}

export function buscarProjeto(id: string, signal?: AbortSignal): Promise<Projeto> {
  return ler<Projeto>(`/projetos/${encodeURIComponent(id)}`, signal);
}

export async function listarTarefasDoProjeto(
  id: string,
  signal?: AbortSignal,
): Promise<Tarefa[]> {
  const projeto = await ler<Projeto & { tarefas: Tarefa[] }>(
    `/projetos/${encodeURIComponent(id)}?_embed=tarefas`,
    signal,
  );
  return projeto.tarefas;
}
