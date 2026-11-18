import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export function useArrastarFicha() {
  const cabecalho = useRef<HTMLElement>(null);
  const posicao = useRef({ x: 0, y: 0 });
  const inicio = useRef<{
    id: number;
    x: number;
    y: number;
    esquerda: number;
    topo: number;
  } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  function mover(x: number, y: number) {
    const modal = cabecalho.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal) return;
    const caixa = modal.getBoundingClientRect();
    const baseX = caixa.left - posicao.current.x;
    const baseY = caixa.top - posicao.current.y;
    const largura = document.documentElement.clientWidth;
    const altura = window.innerHeight;
    const esquerda = Math.max(
      8,
      Math.min(baseX + x, largura - caixa.width - 8),
    );
    const topo = Math.max(8, Math.min(baseY + y, altura - caixa.height - 8));
    posicao.current = { x: esquerda - baseX, y: topo - baseY };
    modal.style.translate = `${posicao.current.x}px ${posicao.current.y}px`;
  }

  useEffect(() => {
    const modal = cabecalho.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal) return;
    const ajustar = () => {
      if (posicao.current.x || posicao.current.y) {
        mover(posicao.current.x, posicao.current.y);
      }
    };
    const observador = new ResizeObserver(ajustar);
    observador.observe(modal);
    window.addEventListener("resize", ajustar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, []);

  function onPointerDown(evento: PointerEvent<HTMLElement>) {
    if (
      evento.button !== 0 ||
      !evento.isPrimary ||
      (evento.target as HTMLElement).closest("button")
    )
      return;
    const modal = cabecalho.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal || modal.hasAttribute("data-exiting")) return;
    inicio.current = {
      id: evento.pointerId,
      x: evento.clientX,
      y: evento.clientY,
      esquerda: posicao.current.x,
      topo: posicao.current.y,
    };
    evento.currentTarget.setPointerCapture(evento.pointerId);
    setArrastando(true);
    evento.preventDefault();
  }

  function onPointerMove(evento: PointerEvent<HTMLElement>) {
    const origem = inicio.current;
    if (!origem || origem.id !== evento.pointerId) return;
    mover(
      origem.esquerda + evento.clientX - origem.x,
      origem.topo + evento.clientY - origem.y,
    );
  }

  function terminar(evento: PointerEvent<HTMLElement>) {
    if (inicio.current?.id !== evento.pointerId) return;
    inicio.current = null;
    setArrastando(false);
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
  }

  function onKeyDown(evento: KeyboardEvent<HTMLElement>) {
    if (evento.target !== evento.currentTarget) return;
    const passo = evento.shiftKey ? 40 : 10;
    const direcoes: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    const direcao = direcoes[evento.key];
    if (!direcao) return;
    evento.preventDefault();
    mover(posicao.current.x + direcao[0], posicao.current.y + direcao[1]);
  }

  return {
    ref: cabecalho,
    "data-arrastando": arrastando || undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp: terminar,
    onPointerCancel: terminar,
    onLostPointerCapture: terminar,
    onKeyDown,
  };
}
