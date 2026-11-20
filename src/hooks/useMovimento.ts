const sistema = matchMedia("(prefers-reduced-motion: reduce)");

export function movimentoReduzido() {
  return sistema.matches;
}
export function observarMovimento(ouvinte: () => void) {
  sistema.addEventListener("change", ouvinte);
  return () => {
    sistema.removeEventListener("change", ouvinte);
  };
}
