import type { NovaTarefa, Projeto, Tarefa } from "./tipos";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000" : "")).replace(/\/$/, "");
const limiteConfigurado = Number(import.meta.env.MODE === "test" ? import.meta.env.VITE_API_TEMPO_LIMITE_MS : undefined);
const TEMPO_LIMITE_MS = Number.isSafeInteger(limiteConfigurado) && limiteConfigurado > 0 ? limiteConfigurado : 15000;

export class ErroApi extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Falha ao consultar a API (${status}).`);
    this.status = status;
  }
}

export class ErroTempoEsgotado extends Error {}

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const signal = opcoes.signal ? AbortSignal.any([opcoes.signal, limite]) : limite;

  try {
    const resposta = await fetch(`${API_URL}${caminho}`, { ...opcoes, signal });

    if (!resposta.ok) {
      throw new ErroApi(resposta.status);
    }

    return (opcoes.method === "DELETE" ? undefined : await resposta.json()) as T;
  } catch (erro) {
    if (signal.aborted && signal.reason?.name === "TimeoutError") {
      throw new ErroTempoEsgotado("O servidor demorou para responder. Tente de novo.", { cause: erro });
    }
    throw erro;
  }
}

function ler<T>(caminho: string, signal?: AbortSignal): Promise<T> {
  return requisitar<T>(caminho, { signal });
}

async function escrever<T>(
  metodo: "POST" | "PATCH",
  caminho: string,
  dados: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return requisitar<T>(caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
    signal,
  });
}

type Registro = Record<string, unknown> & { id: string };

function registro(dado: unknown): Registro | undefined {
  if (typeof dado !== "object" || dado === null || Array.isArray(dado)) return undefined;
  const { id } = dado as Record<string, unknown>;
  return (typeof id === "string" && id !== "") || (typeof id === "number" && Number.isFinite(id)) ? { ...dado, id: String(id) } : undefined;
}

function registroUnico(dado: unknown): Registro {
  const valido = registro(dado);
  if (!valido) throw new SyntaxError("Resposta da API fora do formato esperado.");
  return valido;
}

function colecao<T>(dados: unknown, normalizar: (registro: Registro) => T): T[] {
  if (!Array.isArray(dados)) throw new SyntaxError("Resposta da API fora do formato esperado.");
  return dados.flatMap((dado) => {
    const valido = registro(dado);
    return valido ? [normalizar(valido)] : [];
  });
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function normalizarTarefa(tarefa: Registro): Tarefa {
  return { id: tarefa.id, projetoId: texto(tarefa.projetoId), titulo: texto(tarefa.titulo), descricao: texto(tarefa.descricao), status: tarefa.status as Tarefa["status"], prioridade: tarefa.prioridade as Tarefa["prioridade"], responsavel: texto(tarefa.responsavel), prazo: texto(tarefa.prazo) };
}

function normalizarProjeto(projeto: Registro): Projeto {
  return { id: projeto.id, nome: texto(projeto.nome), descricao: texto(projeto.descricao), disciplina: texto(projeto.disciplina), criadoEm: texto(projeto.criadoEm) };
}

export async function listarTarefas(signal?: AbortSignal): Promise<Tarefa[]> {
  return colecao(await ler<unknown>("/tarefas", signal), normalizarTarefa);
}

export async function listarProjetos(signal?: AbortSignal): Promise<Projeto[]> {
  return colecao(await ler<unknown>("/projetos", signal), normalizarProjeto);
}

export async function buscarTarefa(id: string, signal?: AbortSignal): Promise<Tarefa> {
  return normalizarTarefa(registroUnico(await ler<unknown>(`/tarefas/${encodeURIComponent(id)}`, signal)));
}

export async function buscarProjeto(id: string, signal?: AbortSignal): Promise<Projeto> {
  return normalizarProjeto(registroUnico(await ler<unknown>(`/projetos/${encodeURIComponent(id)}`, signal)));
}

export async function listarTarefasDoProjeto(
  id: string,
  signal?: AbortSignal,
): Promise<Tarefa[]> {
  return (await buscarProjetoComTarefas(id, signal)).tarefas;
}

export async function buscarProjetoComTarefas(id: string, signal?: AbortSignal): Promise<{ projeto: Projeto; tarefas: Tarefa[] }> {
  const projeto = registroUnico(await ler<unknown>(
    `/projetos/${encodeURIComponent(id)}?_embed=tarefas`,
    signal,
  ));
  return { projeto: normalizarProjeto(projeto), tarefas: colecao(projeto.tarefas, normalizarTarefa) };
}

export async function criarTarefa(dados: NovaTarefa, signal?: AbortSignal): Promise<Tarefa> {
  return normalizarTarefa(registroUnico(await escrever<unknown>("POST", "/tarefas", dados, signal)));
}

export async function atualizarTarefa(
  id: string,
  dados: Partial<NovaTarefa>,
  signal?: AbortSignal,
): Promise<Tarefa> {
  return normalizarTarefa(registroUnico(await escrever<unknown>("PATCH", `/tarefas/${encodeURIComponent(id)}`, dados, signal)));
}

export async function excluirTarefa(id: string, signal?: AbortSignal): Promise<void> {
  return requisitar<void>(`/tarefas/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal,
  });
}

// Para a tela, excluir o que outra aba já excluiu é sucesso: o pedido do usuário já está cumprido.
export async function excluirTarefaSeExistir(id: string, signal?: AbortSignal): Promise<void> {
  try {
    await excluirTarefa(id, signal);
  } catch (erro) {
    if (!(erro instanceof ErroApi && erro.status === 404)) throw erro;
  }
}

export function criarProjeto(
  dados: Omit<Projeto, "id">,
  signal?: AbortSignal,
): Promise<Projeto> {
  return escrever<Projeto>("POST", "/projetos", dados, signal);
}

export function atualizarProjeto(
  id: string,
  dados: Partial<Omit<Projeto, "id">>,
  signal?: AbortSignal,
): Promise<Projeto> {
  return escrever<Projeto>("PATCH", `/projetos/${encodeURIComponent(id)}`, dados, signal);
}
