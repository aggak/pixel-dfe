import { createContext, useContext } from "react";
import type { Filtros } from "../derivar";

type EstadoFiltros = { filtros: Filtros; alterar: (parcial: Partial<Filtros>) => void };
export const ContextoFiltros = createContext<EstadoFiltros | null>(null);
export function useFiltros() {
  const contexto = useContext(ContextoFiltros);
  if (!contexto) throw new Error("A página deve estar dentro de FiltrosProvider.");
  return contexto;
}
