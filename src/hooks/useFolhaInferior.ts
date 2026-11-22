import { useSyncExternalStore } from "react";

// Mesmo recorte da folha presa à borda de baixo em FolhaInferior.css.
const celular = matchMedia("(max-width: 650px), (max-height: 500px)");

function observar(ouvinte: () => void) {
  celular.addEventListener("change", ouvinte);
  return () => celular.removeEventListener("change", ouvinte);
}

/* Diz se a ficha está presa à borda de baixo: só as fichas que pedem a
   folha inferior, e só no celular em pé ou deitado. */
export function useFolhaInferior(pedida: boolean) {
  const cabe = useSyncExternalStore(observar, () => celular.matches);
  return pedida && cabe;
}
