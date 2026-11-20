import { useEffect, useSyncExternalStore } from "react";
import { useTema } from "../hooks/useTema";
import { PALETA_PIXEL, type TemaDeCores } from "./catalogo";

const SPRITES = import.meta.glob<string>("../assets/gatinho/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const trocasPorTema = new Map<string, Map<string, string>>();
const recoloridos = new Map<string, string>();
const pedidos = new Set<string>();
const ouvintes = new Set<() => void>();

function arquivo(nome: string, variante: string) {
  return SPRITES[`../assets/gatinho/${nome}-${variante}.svg`];
}

function trocasDoTema(tema: TemaDeCores) {
  const salvas = trocasPorTema.get(tema.id);
  if (salvas) return salvas;
  const sonda = document.createElement("span");
  sonda.hidden = true;
  sonda.dataset.tema = tema.id;
  sonda.dataset.esquema = tema.esquema;
  document.body.append(sonda);
  const estilo = getComputedStyle(sonda);
  const trocas = new Map<string, string>();
  for (const [nome, original] of Object.entries(PALETA_PIXEL)) {
    const valor = estilo.getPropertyValue(nome).trim().toLowerCase();
    if (valor && valor !== original) trocas.set(original, valor);
  }
  sonda.remove();
  trocasPorTema.set(tema.id, trocas);
  return trocas;
}

async function recolorir(
  chave: string,
  url: string,
  trocas: Map<string, string>,
) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error("Não foi possível carregar o sprite");
    const texto = await resposta.text();
    const svg = texto.replace(
      /#[0-9a-f]{6}\b/gi,
      (cor) => trocas.get(cor.toLowerCase()) ?? cor,
    );
    recoloridos.set(
      chave,
      URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
    );
  } catch {
    recoloridos.set(chave, url);
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function observar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useUrlDoSprite(nome: string, escolhido?: TemaDeCores) {
  const atual = useTema();
  const tema = escolhido ?? atual;
  const proprio = arquivo(nome, tema.id);
  const base = arquivo(nome, "escuro");
  const trocas = proprio ? null : trocasDoTema(tema);
  const chave = `${nome}|${tema.id}`;
  const pronto = useSyncExternalStore(observar, () => recoloridos.get(chave));
  const precisa = !!trocas?.size;
  useEffect(() => {
    if (!precisa || !trocas || pedidos.has(chave)) return;
    pedidos.add(chave);
    void recolorir(chave, base, trocas);
  }, [precisa, chave, base, trocas]);
  return proprio ?? (precisa ? pronto : base);
}

export function useSprite(nome: string, escolhido?: TemaDeCores) {
  const url = useUrlDoSprite(nome, escolhido);
  return url ? `url("${url}")` : "none";
}
