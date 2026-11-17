import { useSyncExternalStore } from "react";

const CHAVE = "pixel-animacoes";
const sistema = matchMedia("(prefers-reduced-motion: reduce)");
const ouvintes = new Set<() => void>();
let pausadas = lerEscolha();

function lerEscolha() {
  try {
    return localStorage.getItem(CHAVE) === "pausadas";
  } catch {
    return false;
  }
}
function guardarEscolha() {
  try {
    if (pausadas) localStorage.setItem(CHAVE, "pausadas");
    else localStorage.removeItem(CHAVE);
  } catch {
    return;
  }
}
function marcarDocumento() {
  if (pausadas) document.documentElement.dataset.movimento = "reduzido";
  else delete document.documentElement.dataset.movimento;
}
function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}
marcarDocumento();
sistema.addEventListener("change", avisar);

export function movimentoReduzido() {
  return sistema.matches || pausadas;
}
export function observarMovimento(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
export function pausarAnimacoes(pausar: boolean) {
  pausadas = pausar;
  guardarEscolha();
  marcarDocumento();
  avisar();
}
export function useMovimento() {
  return useSyncExternalStore(observarMovimento, () =>
    sistema.matches ? "sistema" : pausadas ? "pausadas" : "livres",
  );
}
