import type { Status } from "../tipos";

export const TIPO_TAREFA = "application/x-pixel-tarefa";
const SOLTAR_TAREFA = "pixel:soltar-tarefa";

type Soltura = { id: string; status: Status };

export function soltarTarefa(id: string, status: Status) {
  window.dispatchEvent(
    new CustomEvent<Soltura>(SOLTAR_TAREFA, { detail: { id, status } }),
  );
}

export function ouvirSoltura(ouvinte: (soltura: Soltura) => void) {
  const aoSoltar = (evento: Event) =>
    ouvinte((evento as CustomEvent<Soltura>).detail);
  window.addEventListener(SOLTAR_TAREFA, aoSoltar);
  return () => window.removeEventListener(SOLTAR_TAREFA, aoSoltar);
}
