import type { Tarefa } from "../tipos";

const PATINHA = "M2 0h1v2H2zM5 0h1v2H5zM0 2h1v2H0zM7 2h1v2H7zM3 4h2v1H3zM2 5h4v1H2zM1 6h6v1H1zM1 7h2v1H1zM5 7h2v1H5z";
const VAZIA = "M3 2h2v1H3zM2 3h1v2H2zM5 3h1v2H5zM3 5h2v1H3z";
const MAXIMO = 11;

function passosPreenchidos(concluidas: number, total: number) {
  if (total <= MAXIMO) return concluidas;
  if (concluidas === 0) return 0;
  if (concluidas === total) return MAXIMO;
  return Math.max(1, Math.min(MAXIMO - 1, Math.round((concluidas / total) * MAXIMO)));
}

export function TrilhaPatinhas({ tarefas }: { tarefas?: Tarefa[] }) {
  if (!tarefas) return <div className="e-trilha" />;
  const total = tarefas.length;
  if (total === 0) return <div className="e-trilha"><span className="e-trilha-contagem">Sem tarefas</span></div>;
  const concluidas = tarefas.filter((tarefa) => tarefa.status === "concluida").length;
  const preenchidos = passosPreenchidos(concluidas, total);
  return <div className="e-trilha">
    <div className="e-trilha-passos" aria-hidden="true">{Array.from({ length: Math.min(total, MAXIMO) }, (_, i) => <svg key={i} className={i < preenchidos ? undefined : "e-trilha-falta"} viewBox="0 0 8 8" width="16" height="16" fill="currentColor" focusable="false"><path d={i < preenchidos ? PATINHA : VAZIA} /></svg>)}</div>
    <span className="e-trilha-contagem"><strong>{concluidas} de {total}</strong> {total === 1 ? "concluída" : "concluídas"}{total > MAXIMO && <span className="e-trilha-nota">Trilha proporcional</span>}</span>
  </div>;
}
