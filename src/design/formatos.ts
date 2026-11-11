import type { Prioridade, Status } from "../tipos";

export const statusTexto: Record<Status, string> = {
  "a-fazer": "A fazer", "em-andamento": "Em andamento", "em-revisao": "Em revisão", concluida: "Concluída",
};
export const prioridadeTexto: Record<Prioridade, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
export function formatarData(iso: string, extensa = false) {
  const data = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", extensa ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" }).format(data);
}
export function prazoVencido(iso: string, hoje = new Date()) {
  const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso < dia;
}
