import type { Tarefa } from "../tipos";
import { PawIcon } from "../design/icon";
import { formatarData } from "../design/formatos";
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
        {carregando && (
          <>
            <div className="e-proj-foot-txt">
              <span className="e-proj-prog">
                <span className="e-loading-dot" aria-hidden="true" />
                Carregando andamento…
              </span>
            </div>
            <span className="e-proj-bar e-proj-bar-vazia" aria-hidden="true" />
          </>
        )}
      </div>
    );
  const total = tarefas.length;
  const concluidas = tarefas.filter(
    (tarefa) => tarefa.status === "concluida",
  ).length;
  const prazo = tarefas
    .filter((tarefa) => tarefa.status !== "concluida" && tarefa.prazo)
    .map((tarefa) => tarefa.prazo)
    .sort()[0];
  const porcento = total ? Math.round((concluidas / total) * 100) : 0;
  return (
    <div className="e-proj-foot">
      <div className="e-proj-foot-txt">
        {total === 0 && <span className="e-proj-prog">Sem tarefas ainda</span>}
        {total > 0 && concluidas === total && (
          <span className="e-proj-prog e-proj-ok">
            <PawIcon />
            {total === 1 ? "Tarefa concluída" : `Todas as ${total} concluídas`}
          </span>
        )}
        {total > 0 && concluidas < total && (
          <span className="e-proj-prog">
            <b>{concluidas}</b> de {total}{" "}
            {concluidas === 1 ? "concluída" : "concluídas"}
          </span>
        )}
        {prazo && (
          <span className="e-proj-prazo">
            Próximo prazo <b>{formatarData(prazo)}</b>
          </span>
        )}
      </div>
      <span
        className={`e-proj-bar${total ? "" : " e-proj-bar-vazia"}`}
        aria-hidden="true"
      >
        {porcento > 0 && <i style={{ width: `${porcento}%` }} />}
      </span>
    </div>
  );
}
