import { useCallback, useMemo, useState, type ReactNode } from "react";
import { filtrosIniciais, type Filtros } from "../derivar";
import { ContextoFiltros } from "./filtros-contexto";

// Fica acima das rotas para que a `key` que remonta as páginas não descarte a busca e os filtros.
export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciais);
  const alterar = useCallback((parcial: Partial<Filtros>) => setFiltros((atual) => ({ ...atual, ...parcial })), []);
  const valor = useMemo(() => ({ filtros, alterar }), [filtros, alterar]);
  return <ContextoFiltros.Provider value={valor}>{children}</ContextoFiltros.Provider>;
}
