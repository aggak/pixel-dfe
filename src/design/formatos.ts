import type { Prioridade, Status } from "../tipos";

const CONECTIVOS = new Set(["A", "AS", "O", "OS", "DA", "DAS", "DE", "DO", "DOS", "E", "EM", "PARA"]);

export function iniciais(nome: string) {
  const palavras = nome.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const principais = palavras.filter((palavra) => !CONECTIVOS.has(palavra));
  return principais.length > 1 ? principais.slice(0, 2).map((palavra) => palavra[0]).join("") : (principais[0] ?? palavras[0] ?? "?").slice(0, 2);
}

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== iso) return false;
  const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return iso < dia;
}
