import type { DOMAttributes, RefObject } from "react";
import { isTextDropItem, useDrop } from "react-aria-components";
import type { Status } from "../tipos";

export const TIPO_TAREFA = "application/x-pixel-tarefa";
// O tipo carrega o status de origem, porque getDropOperation só enxerga os tipos: assim a coluna de origem não vira alvo.
export const tipoStatusOrigem = (status: Status) => `application/x-pixel-status-${status}`;
export const MOVER_TAREFA = "pixel:mover-tarefa";

// A coluna só sabe qual tarefa caiu nela; quem muda o status é o cartão, que já cuida de travas e falhas.
export function pedirMudancaStatus(id: string, status: Status) {
  window.dispatchEvent(new CustomEvent(MOVER_TAREFA, { detail: { id, status } }));
}

export function useSoltarNaColuna(ref: RefObject<HTMLElement | null>, status: Status): { dropProps: DOMAttributes<HTMLElement>; isDropTarget: boolean } {
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (tipos) => (tipos.has(TIPO_TAREFA) && !tipos.has(tipoStatusOrigem(status)) ? "move" : "cancel"),
    onDrop: async (e) => {
      const item = e.items.find((candidato) => isTextDropItem(candidato) && candidato.types.has(TIPO_TAREFA));
      if (!item || !isTextDropItem(item)) return;
      try { pedirMudancaStatus(await item.getText(TIPO_TAREFA), status); } catch { /* a leitura do item pode falhar se o arrasto for abortado */ }
    },
  });
  return { dropProps, isDropTarget };
}
