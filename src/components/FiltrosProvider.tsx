import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FILTROS_INICIAIS, type Filtros } from "../derivar";
import { ContextoFiltros } from "./filtros-contexto";

export function FiltrosProvider({ children }: { children: ReactNode }) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const alterar = useCallback(
    (parcial: Partial<Filtros>) =>
      setFiltros((atual) => ({ ...atual, ...parcial })),
    [],
  );
  const limpar = useCallback(() => setFiltros(FILTROS_INICIAIS), []);
  const valor = useMemo(
    () => ({ filtros, alterar, limpar }),
    [filtros, alterar, limpar],
  );
  return <ContextoFiltros value={valor}>{children}</ContextoFiltros>;
}
