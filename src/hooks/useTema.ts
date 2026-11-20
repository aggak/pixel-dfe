import "../temas/estilos";
import { useSyncExternalStore } from "react";
import { TEMAS_DE_CORES, type TemaDeCores } from "../temas/catalogo";

const CHAVE = "pixel-tema";
const CHAVE_ESQUEMA = "pixel-esquema";
const CHAVE_FUNDO = "pixel-tema-fundo";
const ouvintes = new Set<() => void>();
let atual = lerEscolha();

function lerEscolha() {
  let id: string | null = null;
  try {
    id = localStorage.getItem(CHAVE);
  } catch {
    id = null;
  }
  return TEMAS_DE_CORES.find((tema) => tema.id === id) ?? TEMAS_DE_CORES[0];
}
function guardarEscolha(fundo: string) {
  try {
    if (atual === TEMAS_DE_CORES[0]) {
      localStorage.removeItem(CHAVE);
      localStorage.removeItem(CHAVE_ESQUEMA);
      localStorage.removeItem(CHAVE_FUNDO);
    } else {
      localStorage.setItem(CHAVE, atual.id);
      localStorage.setItem(CHAVE_ESQUEMA, atual.esquema);
      if (fundo) localStorage.setItem(CHAVE_FUNDO, `${atual.id}:${fundo}`);
      else localStorage.removeItem(CHAVE_FUNDO);
    }
  } catch {
    return;
  }
}
function marcarDocumento() {
  const raiz = document.documentElement;
  const escuro = atual.esquema === "escuro";
  raiz.dataset.tema = atual.id;
  raiz.dataset.esquema = atual.esquema;
  raiz.classList.toggle("dark", escuro);
  raiz.classList.toggle("dark-mode", escuro);
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", escuro ? "dark" : "light");
  const fundo = getComputedStyle(raiz).getPropertyValue("--e-back").trim();
  if (fundo)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", fundo);
  return fundo;
}
guardarEscolha(marcarDocumento());

export function escolherTema(id: string) {
  const tema = TEMAS_DE_CORES.find((item) => item.id === id);
  if (!tema || tema === atual) return;
  atual = tema;
  guardarEscolha(marcarDocumento());
  for (const ouvinte of ouvintes) ouvinte();
}
function observarTema(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
export function useTema(): TemaDeCores {
  return useSyncExternalStore(observarTema, () => atual);
}
