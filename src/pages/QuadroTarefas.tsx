import { useRef, type ReactNode } from "react";
import { isTextDropItem, useDrop } from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import { GatinhoLavando } from "../components/GatinhoLavando";
import { VisaoTarefas } from "../components/VisaoTarefas";
import { agruparPorStatus } from "../derivar";
import { statusTexto } from "../design/formatos";
import { Icon } from "../design/icon";
import { soltarTarefa, TIPO_TAREFA } from "../hooks/arrastar-tarefa";
import type { Status } from "../tipos";

const iconesStatus: Record<Status, string> = {
  "a-fazer": "circle",
  "em-andamento": "play",
  "em-revisao": "eye",
  concluida: "check",
};

function Coluna({ status, children }: { status: Status; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (tipos) => (tipos.has(TIPO_TAREFA) ? "move" : "cancel"),
    onDrop: async ({ items }) => {
      const item = items.find(
        (atual) => isTextDropItem(atual) && atual.types.has(TIPO_TAREFA),
      );
      if (item && isTextDropItem(item))
        soltarTarefa(await item.getText(TIPO_TAREFA), status);
    },
  });
  return (
    <section
      {...dropProps}
      ref={ref}
      className={`e-column${isDropTarget ? " e-column-alvo" : ""}`}
      aria-label={statusTexto[status]}
      data-status-column={status}
    >
      {children}
    </section>
  );
}

export function QuadroTarefas() {
  return (
    <VisaoTarefas titulo="Quadro" classeConteudo="e-content e-board-content">
      {(tarefas, cartao, todasTarefas) => (
        <section className="e-board" aria-label="Quadro de tarefas por status">
          {agruparPorStatus(tarefas).map((coluna) => (
            <Coluna key={coluna.status} status={coluna.status}>
              <h2>
                <span className="e-column-name">
                  <Icon name={iconesStatus[coluna.status]} />
                  <span>{statusTexto[coluna.status]}</span>
                </span>
                <Badge type="modern" color="gray" size="sm">
                  {coluna.tarefas.length}
                </Badge>
              </h2>
              {coluna.tarefas.map((tarefa) => cartao(tarefa, "quadro"))}
              {coluna.tarefas.length === 0 && (
                <p className="e-column-empty">
                  <GatinhoLavando />
                  {todasTarefas.some(
                    (tarefa) => tarefa.status === coluna.status,
                  )
                    ? "Nenhuma tarefa encontrada"
                    : "Nenhuma tarefa"}
                </p>
              )}
            </Coluna>
          ))}
        </section>
      )}
    </VisaoTarefas>
  );
}
