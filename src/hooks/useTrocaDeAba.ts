import { useCallback, useEffect, useState } from "react";

// A página inteira remonta a cada navegação (App.tsx usa key nas rotas), então a aba anterior fica fora do componente.
// null: as abas ainda não foram renderizadas nesta carga.
let abaAnterior: string | null = null;

// `puxada` vale 0 sem animação e cresce a cada troca de aba ativa; serve de key da pata para reiniciar a animação.
export function useTrocaDeAba(chave: string) {
  // Lido na renderização: no StrictMode o primeiro efeito já teria atualizado a variável de módulo.
  const anterior = abaAnterior;
  const [puxada, setPuxada] = useState(0);
  useEffect(() => {
    // A troca vem da navegação (sistema externo ao componente), e a animação precisa começar depois da montagem.
    // oxlint-disable-next-line react/set-state-in-effect
    if (anterior !== null && anterior !== chave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPuxada((n) => n + 1);
    abaAnterior = chave;
  }, [anterior, chave]);
  const encerrar = useCallback(() => setPuxada(0), []);
  return { puxada, encerrar };
}
