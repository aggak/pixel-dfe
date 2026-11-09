import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const MARGEM = 8;
const ALTURA_MINIMA_VISIVEL = 56;
const INTERATIVOS = "button, a, input, textarea, select, [role=button]";
const ZERO = { x: 0, y: 0 };
const limitar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo);

// Move a ficha pelo cabeçalho, sem sair da tela. A posição fica em `translate`, separada do `transform` da animação.
export function useArrastarFicha(casca: RefObject<HTMLElement | null>) {
  const [deslocamento, setDeslocamento] = useState(ZERO);
  const [arrastando, setArrastando] = useState(false);

  // Encerra o arrasto em andamento (soltar, captura perdida ou redimensionamento).
  const encerrar = useRef<(() => void) | null>(null);

  useEffect(() => {
    const zerar = () => {
      encerrar.current?.();
      setDeslocamento(ZERO);
      // O arrasto escreve no DOM por fora do React: sem isso, um translate inline sobraria se o estado já fosse 0,0.
      casca.current?.closest<HTMLElement>(".e-form-modal")?.style.removeProperty("translate");
    };
    window.addEventListener("resize", zerar);
    return () => window.removeEventListener("resize", zerar);
  }, [casca]);

  // Desmontar no meio do arrasto cancela o quadro pendente e solta a captura.
  useEffect(() => () => encerrar.current?.(), []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const alca = e.currentTarget;
    const modal = casca.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal || e.button !== 0 || (e.target as Element).closest(INTERATIVOS) || window.matchMedia("(max-width: 650px)").matches || encerrar.current) return;
    e.preventDefault();
    // A entrada anima a escala: usa o tamanho de layout, centrado onde o modal aparece agora.
    const atual = modal.getBoundingClientRect();
    const [cx, cy] = [atual.left + atual.width / 2, atual.top + atual.height / 2];
    const rect0 = { left: cx - modal.offsetWidth / 2, right: cx + modal.offsetWidth / 2, top: cy - modal.offsetHeight / 2 };
    const { clientX: px, clientY: py, pointerId } = e;
    const d0 = deslocamento;
    const minX = d0.x - (rect0.left - MARGEM), maxX = d0.x + (window.innerWidth - MARGEM - rect0.right);
    const minY = d0.y - (rect0.top - MARGEM), maxY = d0.y + (window.innerHeight - ALTURA_MINIMA_VISIVEL - rect0.top);
    // Durante o arrasto a posição fica em variáveis locais e vai direto ao DOM, no máximo uma vez por quadro; o React só a recebe ao soltar.
    let [ultimoX, ultimoY, quadro, desenhado] = [px, py, 0, d0];
    const desenhar = () => {
      quadro = 0;
      desenhado = { x: limitar(d0.x + (ultimoX - px), minX, maxX), y: limitar(d0.y + (ultimoY - py), minY, maxY) };
      modal.style.translate = `${desenhado.x}px ${desenhado.y}px`;
    };
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      [ultimoX, ultimoY] = [ev.clientX, ev.clientY];
      if (!quadro) quadro = requestAnimationFrame(desenhar);
    };
    const soltar = () => {
      if (quadro) { cancelAnimationFrame(quadro); desenhar(); }
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", soltar);
      alca.removeEventListener("pointercancel", soltar);
      alca.removeEventListener("lostpointercapture", soltar);
      encerrar.current = null;
      setDeslocamento(desenhado);
      setArrastando(false);
      if (!desenhado.x && !desenhado.y) modal.style.translate = "";
    };
    encerrar.current = soltar;
    alca.setPointerCapture(pointerId);
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);
    alca.addEventListener("lostpointercapture", soltar);
    setArrastando(true);
  }, [casca, deslocamento]);

  const onDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest(INTERATIVOS)) return;
    setDeslocamento(ZERO);
  }, []);

  return { deslocamento, arrastando, propsAlca: { onPointerDown, onDoubleClick } };
}
