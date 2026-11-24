import type { Tarefa } from "../tipos";
import { PawIcon } from "../design/icon";
import { camadasDoTema, type TemaFelino } from "../design/temas-felinos";

export function IconeFelino({
  tema,
  escala = 2,
  className = "e-proj-icone",
}: {
  tema?: TemaFelino;
  escala?: number;
  className?: string;
}) {
  if (!tema) return null;
  return (
    <span className={className} aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        width={16 * escala}
        height={16 * escala}
        shapeRendering="crispEdges"
        focusable="false"
      >
        {camadasDoTema(tema).map(({ cor, d }) => (
          <path key={cor} style={{ fill: cor }} d={d} />
        ))}
      </svg>
    </span>
  );
}

export function AndamentoProjeto({
  tarefas,
  carregando = false,
}: {
  tarefas?: Tarefa[];
  carregando?: boolean;
}) {
  if (!tarefas)
    return (
      <div className="e-proj-foot">
        {carregando ? (
          <>
            <div className="e-proj-foot-txt">
              <span className="e-proj-prog">
                <span className="e-loading-dot" aria-hidden="true" />
                Carregando andamento…
              </span>
            </div>
            <span className="e-proj-bar e-proj-bar-vazia" aria-hidden="true" />
          </>
        ) : (
          <div className="e-proj-foot-txt">
            <span className="e-proj-prog">Andamento indisponível</span>
          </div>
        )}
      </div>
    );
  const total = tarefas.length;
  const concluidas = tarefas.filter(
    (tarefa) => tarefa.status === "concluida",
  ).length;
  const concluido = total > 0 && concluidas === total;
  const porcento = total ? (concluidas / total) * 100 : 0;
  const percentual = concluido
    ? 100
    : concluidas > 0
      ? Math.min(99, Math.max(1, Math.round(porcento)))
      : 0;
  return (
    <div
      className="e-proj-foot"
      data-concluido={concluido || undefined}
      data-vazio={total === 0 || undefined}
    >
      {(total === 0 || concluido) && (
        <div className="e-proj-foot-txt">
          {total === 0 ? (
            <span className="e-proj-prog">Sem tarefas ainda</span>
          ) : (
            <span className="e-proj-prog e-proj-ok">
              <PawIcon />
              {total === 1 ? "Tarefa concluída" : "Todas as tarefas concluídas"}
            </span>
          )}
        </div>
      )}
      <span
        className={`e-proj-bar${total ? "" : " e-proj-bar-vazia"}`}
        {...(total > 0
          ? {
              role: "progressbar",
              "aria-label": "Tarefas concluídas",
              "aria-valuenow": percentual,
              "aria-valuetext": `${concluidas} de ${total}`,
            }
          : { "aria-hidden": true })}
      >
        {porcento > 0 && <i style={{ width: `${porcento}%` }} />}
      </span>
    </div>
  );
}
