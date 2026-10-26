import { createContext, useContext } from "react";
import type { Filtros } from "../derivar";

export interface ContextoFiltrosValor {
  filtros: Filtros;
  alterar: (parcial: Partial<Filtros>) => void;
  limpar: () => void;
}
export const ContextoFiltros = createContext<ContextoFiltrosValor | null>(null);
export function useFiltros() {
  const contexto = useContext(ContextoFiltros);
  if (!contexto) throw new Error("useFiltros deve ser usado dentro de um FiltrosProvider.");
  return contexto;
}
