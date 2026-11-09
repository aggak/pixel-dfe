import { useCallback, useEffect, useState, type RefObject } from "react";

// Diz se há abas escondidas de cada lado da barra e rola 80 % da largura visível. `dependencia` refaz a medida quando a lista muda.
export function useRolagemAbas(ref: RefObject<HTMLElement | null>, dependencia?: unknown) {
  const [lados, setLados] = useState({ temEsquerda: false, temDireita: false });
  const medir = useCallback(() => {
    const barra = ref.current;
    if (!barra) return;
    const temEsquerda = barra.scrollLeft > 1;
    const temDireita = barra.scrollLeft + barra.clientWidth < barra.scrollWidth - 1;
    setLados((atual) => atual.temEsquerda === temEsquerda && atual.temDireita === temDireita ? atual : { temEsquerda, temDireita });
  }, [ref]);
  useEffect(() => {
    const barra = ref.current;
    if (!barra) return;
    barra.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(barra);
    return () => { barra.removeEventListener("scroll", medir); observador.disconnect(); };
  }, [ref, medir]);
  useEffect(medir, [medir, dependencia]);
  // A fonte da página alarga as abas sem mudar a caixa da barra: o ResizeObserver não percebe.
  useEffect(() => { let ativo = true; document.fonts?.ready.then(() => { if (ativo) medir(); }); return () => { ativo = false; }; }, [medir]);
  const rolar = useCallback((lado: -1 | 1) => {
    const barra = ref.current;
    if (!barra) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    barra.scrollBy({ left: lado * barra.clientWidth * 0.8, behavior: reduzido ? "auto" : "smooth" });
  }, [ref]);
  return { ...lados, rolar };
}

// Rola só a barra (nunca a janela) até a aba ficar inteira na área livre, longe das setas e do degradê (scroll-padding da barra).
export function alinharAba(barra: HTMLElement, aba: Element) {
  const folga = parseFloat(getComputedStyle(barra).scrollPaddingLeft) || 0;
  const b = barra.getBoundingClientRect();
  const a = aba.getBoundingClientRect();
  if (a.left < b.left + folga) barra.scrollLeft += a.left - (b.left + folga);
  else if (a.right > b.right - folga) barra.scrollLeft += a.right - (b.right - folga);
}
