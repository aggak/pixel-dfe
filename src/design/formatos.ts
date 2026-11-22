import type { Prioridade, Status } from "../tipos";

export const statusTexto: Record<Status, string> = {
  "a-fazer": "A fazer",
  "em-andamento": "Em andamento",
  "em-revisao": "Em revisão",
  concluida: "Concluída",
};
export const prioridadeTexto: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
export const iconesPrioridade: Record<Prioridade, string> = {
  alta: "angle-double-small-up",
  media: "minus-small",
  baixa: "arrow-small-down",
};
export function formatarData(iso: string, extensa = false) {
  const data = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat(
    "pt-BR",
    extensa
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short" },
  ).format(data);
}
export function dataValida(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T12:00:00Z`);
  return (
    !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso
  );
}
export function formatarPrazoCartao(iso: string, hoje = new Date()) {
  const data = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    ...(data.getFullYear() !== hoje.getFullYear()
      ? ({ year: "numeric" } as const)
      : {}),
  })
    .format(data)
    .replaceAll(" de ", " ")
    .replace(".", "");
}

/* Dias corridos de hoje até o prazo: negativo quando já venceu, undefined
   quando a data gravada não é válida. O prazo é lido como ISO em UTC para
   que os anos 0000 a 0099 não virem 1900 a 1999. */
export function diasAtePrazo(iso: string, hoje = new Date()) {
  if (!dataValida(iso)) return undefined;
  const prazo = Date.parse(`${iso}T00:00:00Z`);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((prazo - base) / 86_400_000);
}

const DIA_DA_SEMANA = [
  "num domingo",
  "numa segunda-feira",
  "numa terça-feira",
  "numa quarta-feira",
  "numa quinta-feira",
  "numa sexta-feira",
  "num sábado",
];
const contarDias = (dias: number) =>
  Math.abs(dias) === 1 ? "1 dia" : `${Math.abs(dias)} dias`;

/* O que a ficha da tarefa diz do prazo: o dia e o mês da folha de
   calendário, a frase de quanto falta e a cor do estado. Concluída, a frase
   só lembra em que dia da semana caía o prazo. */
export function lerPrazo(iso: string, concluida: boolean, hoje = new Date()) {
  const dias = diasAtePrazo(iso, hoje);
  if (dias === undefined) return undefined;
  const data = new Date(`${iso}T00:00:00Z`);
  const semana = DIA_DA_SEMANA[data.getUTCDay()];
  const folha = { dia: data.getUTCDate(), mes: data.getUTCMonth() };
  if (concluida)
    return { ...folha, estado: "concluida", frase: `Prazo ${semana}` };
  if (dias < -1)
    return {
      ...folha,
      estado: "atrasada",
      frase: `Venceu há ${contarDias(dias)}, ${semana}`,
    };
  if (dias === -1)
    return { ...folha, estado: "atrasada", frase: `Venceu ontem, ${semana}` };
  if (dias === 0)
    return { ...folha, estado: "perto", frase: `Vence hoje, ${semana}` };
  if (dias === 1)
    return { ...folha, estado: "perto", frase: `Vence amanhã, ${semana}` };
  return {
    ...folha,
    estado: dias <= 2 ? "perto" : "longe",
    frase: `Faltam ${contarDias(dias)}, cai ${semana}`,
  };
}
