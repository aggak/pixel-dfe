import type { DOMAttributes, RefObject } from "react";
import { isTextDropItem, useDrop } from "react-aria-components";
import type { Status } from "../tipos";

export const TIPO_TAREFA = "application/x-pixel-tarefa";
export const MOVER_TAREFA = "pixel:mover-tarefa";

// A coluna só sabe qual tarefa caiu nela; quem muda o status é o cartão, que já cuida de travas e falhas.
export function pedirMudancaStatus(id: string, status: Status) {
  window.dispatchEvent(new CustomEvent(MOVER_TAREFA, { detail: { id, status } }));
}

export function useSoltarNaColuna(ref: RefObject<HTMLElement | null>, status: Status): { dropProps: DOMAttributes<HTMLElement>; isDropTarget: boolean } {
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (tipos) => (tipos.has(TIPO_TAREFA) ? "move" : "cancel"),
    onDrop: async (e) => {
      const item = e.items.find((candidato) => isTextDropItem(candidato) && candidato.types.has(TIPO_TAREFA));
      if (!item || !isTextDropItem(item)) return;
      pedirMudancaStatus(await item.getText(TIPO_TAREFA), status);
    },
  });
  return { dropProps, isDropTarget };
}
