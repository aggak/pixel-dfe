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
export const iconeStatus: Record<Status, string> = { "a-fazer": "circle", "em-andamento": "play", "em-revisao": "eye", concluida: "check" };
export function diasAtePrazo(iso: string, hoje = new Date()) {
  const prazo = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(prazo.getTime())) return null;
  return Math.round((prazo.getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12).getTime()) / 864e5);
}
