import type { Tarefa } from "../tipos";
import { PawIcon } from "../design/icon";
import { formatarData, iniciais, prazoVencido } from "../design/formatos";

const GLIFOS: Record<string, number[]> = {
  A: [30, 33, 33, 33, 63, 33, 33, 33, 33],
  B: [62, 33, 33, 33, 62, 33, 33, 33, 62],
  C: [30, 33, 32, 32, 32, 32, 32, 33, 30],
  D: [60, 34, 33, 33, 33, 33, 33, 34, 60],
  E: [63, 32, 32, 32, 62, 32, 32, 32, 63],
  F: [63, 32, 32, 32, 62, 32, 32, 32, 32],
  G: [30, 33, 32, 32, 39, 33, 33, 33, 30],
  H: [33, 33, 33, 33, 63, 33, 33, 33, 33],
  I: [28, 8, 8, 8, 8, 8, 8, 8, 28],
  J: [7, 2, 2, 2, 2, 2, 34, 34, 28],
  K: [33, 34, 36, 40, 48, 40, 36, 34, 33],
  L: [32, 32, 32, 32, 32, 32, 32, 32, 63],
  M: [33, 51, 45, 45, 33, 33, 33, 33, 33],
  N: [33, 49, 49, 41, 45, 37, 35, 35, 33],
  O: [30, 33, 33, 33, 33, 33, 33, 33, 30],
  P: [62, 33, 33, 33, 62, 32, 32, 32, 32],
  Q: [30, 33, 33, 33, 33, 33, 37, 34, 29],
  R: [62, 33, 33, 33, 62, 40, 36, 34, 33],
  S: [31, 32, 32, 32, 30, 1, 1, 1, 62],
  T: [62, 8, 8, 8, 8, 8, 8, 8, 8],
  U: [33, 33, 33, 33, 33, 33, 33, 33, 30],
  V: [33, 33, 33, 33, 33, 33, 18, 18, 12],
  W: [33, 33, 33, 33, 33, 45, 45, 51, 33],
  X: [33, 33, 18, 18, 12, 18, 18, 33, 33],
  Y: [33, 33, 18, 18, 12, 12, 12, 12, 12],
  Z: [63, 1, 2, 4, 12, 8, 16, 32, 63],
  0: [30, 33, 35, 37, 41, 49, 33, 33, 30],
  1: [4, 12, 20, 4, 4, 4, 4, 4, 31],
  2: [30, 33, 1, 1, 2, 4, 8, 16, 63],
  3: [62, 1, 1, 1, 30, 1, 1, 1, 62],
  4: [2, 6, 10, 18, 34, 63, 2, 2, 2],
  5: [63, 32, 32, 32, 62, 1, 1, 1, 62],
  6: [30, 32, 32, 32, 62, 33, 33, 33, 30],
  7: [63, 1, 2, 2, 4, 4, 8, 8, 8],
  8: [30, 33, 33, 33, 30, 33, 33, 33, 30],
  9: [30, 33, 33, 33, 31, 1, 1, 1, 30],
  "?": [30, 33, 1, 2, 4, 8, 8, 0, 8],
};
export function Monograma({ nome, className = "e-proj-mono" }: { nome: string; className?: string }) {
  const letras = [...iniciais(nome)];
  const largura = letras.length * 6 + (letras.length - 1) * 2;
  const desenho = letras.map((letra, i) => (GLIFOS[letra] ?? GLIFOS["?"]).map((linha, y) => Array.from({ length: 6 }, (_, x) => (linha & (32 >> x) ? `M${i * 8 + x} ${y}h1v1h-1z` : "")).join("")).join("")).join("");
  return <span className={className} aria-hidden="true"><svg viewBox={`0 0 ${largura} 9`} width={largura * 2} height="18" shapeRendering="crispEdges" focusable="false"><path fill="currentColor" d={desenho} /></svg></span>;
}

export function AndamentoProjeto({ tarefas }: { tarefas?: Tarefa[] }) {
  if (!tarefas) return <div className="e-proj-foot" />;
  const total = tarefas.length;
  const concluidas = tarefas.filter((tarefa) => tarefa.status === "concluida").length;
  const prazo = tarefas.filter((tarefa) => tarefa.status !== "concluida" && tarefa.prazo).map((tarefa) => tarefa.prazo).sort()[0];
  const porcento = total ? Math.round((concluidas / total) * 100) : 0;
  const vencido = prazo ? prazoVencido(prazo) : false;
  return <div className="e-proj-foot">
    <div className="e-proj-foot-txt">
      {total === 0 && <span className="e-proj-prog">Sem tarefas ainda</span>}
      {total > 0 && concluidas === total && <span className="e-proj-prog e-proj-ok"><PawIcon />{total === 1 ? "Tarefa concluída" : `Todas as ${total} concluídas`}</span>}
      {total > 0 && concluidas < total && <span className="e-proj-prog"><b>{concluidas}</b> de {total} {concluidas === 1 ? "concluída" : "concluídas"}</span>}
      {prazo && <span className={`e-proj-prazo${vencido ? " e-proj-vencido" : ""}`}>{vencido ? "Prazo vencido" : "Próximo prazo"} <b>{formatarData(prazo)}</b></span>}
    </div>
    <span className={`e-proj-bar${total ? "" : " e-proj-bar-vazia"}`} aria-hidden="true">{porcento > 0 && <i style={{ width: `${porcento}%` }} />}</span>
  </div>;
}
