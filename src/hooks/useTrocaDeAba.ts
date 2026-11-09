import { useCallback, useEffect, useState } from "react";

// A página inteira remonta a cada navegação (App.tsx usa key nas rotas), então a aba anterior fica fora do componente.
// null: as abas ainda não foram renderizadas nesta carga.
let abaAnterior: string | null = null;

// `puxada` vale 0 sem animação e 1 quando a aba ativa acabou de mudar; serve de key da pata para reiniciar a animação.
export function useTrocaDeAba(chave: string) {
  // Decidido na primeira renderização: no StrictMode o efeito já teria atualizado a variável de módulo.
  const [puxada, setPuxada] = useState(() => abaAnterior !== null && abaAnterior !== chave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0);
  useEffect(() => { abaAnterior = chave; }, [chave]);
  const encerrar = useCallback(() => setPuxada(0), []);
  return { puxada, encerrar };
}
