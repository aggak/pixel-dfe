import { useCallback, useEffect, useState, type RefObject } from "react";

const MARGEM = 8;
const ALTURA_MINIMA_VISIVEL = 56;
const ZERO = { x: 0, y: 0 };
const limitar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

// Move a ficha pelo cabeçalho, sem sair da tela. A posição fica em `translate`, separada do `transform` da animação.
export function useArrastarFicha(casca: RefObject<HTMLElement | null>) {
  const [deslocamento, setDeslocamento] = useState(ZERO);
  const [arrastando, setArrastando] = useState(false);

  useEffect(() => {
    const zerar = () => setDeslocamento(ZERO);
    window.addEventListener("resize", zerar);
    return () => window.removeEventListener("resize", zerar);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const alca = e.currentTarget;
    const modal = casca.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal || e.button !== 0 || (e.target as Element).closest("button, a, input, textarea, select") || window.matchMedia("(max-width: 650px)").matches) return;
    e.preventDefault();
    const rect0 = modal.getBoundingClientRect();
    const { clientX: px, clientY: py, pointerId } = e;
    const d0 = deslocamento;
    const minX = d0.x - (rect0.left - MARGEM), maxX = d0.x + (window.innerWidth - MARGEM - rect0.right);
    const minY = d0.y - (rect0.top - MARGEM), maxY = d0.y + (window.innerHeight - ALTURA_MINIMA_VISIVEL - rect0.top);
    const mover = (ev: PointerEvent) => setDeslocamento({ x: limitar(d0.x + (ev.clientX - px), minX, maxX), y: limitar(d0.y + (ev.clientY - py), minY, maxY) });
    const soltar = () => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      setArrastando(false);
    };
    alca.setPointerCapture(pointerId);
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
    setArrastando(true);
  }, [casca, deslocamento]);

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest("button, a, input, textarea, select")) return;
    setDeslocamento(ZERO);
  }, []);

  return { deslocamento, arrastando, propsAlca: { onPointerDown, onDoubleClick } };
}
