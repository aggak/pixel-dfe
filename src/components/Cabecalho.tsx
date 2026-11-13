import { useContext, useEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router";
import { ContextoAcaoCabecalho } from "./acao-cabecalho-contexto";
import gatoEscuro from "../assets/gatinho/cabecalho-gato-escuro.svg";
import logoEscuro from "../assets/gatinho/cabecalho-logo-escuro.svg";

type Passo = [quadro: number, ms: number];
const LARGURA_LOGO = 84;
const LARGURA_GATO = 72;
const entrada: Passo[] = [[1, 80], [2, 80], [3, 80], [4, 80], [5, 80], [6, 80], [7, 120], [0, 240]];
const troca: Passo[] = [[1, 80], [2, 80], [3, 80], [4, 80], [5, 80], [6, 80], [7, 120], [0, 240]];
const tecla: Passo[] = [[8, 80], [9, 120], [8, 80], [0, 80]];
const onda: Passo[] = [[0, 3040], ...Array.from({ length: 9 }, (_, i): Passo => [10 + i, 120]), [0, 680]];
const sequencias = { entrada, troca, tecla, onda };
const pausasPiscada = [5300, 11200, 7100, 14900];

function useLogoAnimado() {
  const { pathname } = useLocation();
  const caminhoAnterior = useRef(pathname);
  const trocar = useRef<(() => void) | null>(null);
  const logo = useRef<HTMLAnchorElement>(null);
  const palavra = useRef<HTMLSpanElement>(null);
  const gato = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const elLogo = logo.current, elPalavra = palavra.current, elGato = gato.current;
    if (!elLogo || !elPalavra || !elGato) return;
    const movimento = matchMedia("(prefers-reduced-motion: reduce)");
    const parado = () => movimento.matches || document.hidden;
    const mostrarPalavra = (quadro: number) => { elPalavra.style.backgroundPositionX = `${-quadro * LARGURA_LOGO}px`; };
    const mostrarGato = (quadro: number) => { elGato.style.backgroundPositionX = `${-quadro * LARGURA_GATO}px`; };
    let fase: keyof typeof sequencias = "entrada";
    let decorrido = 0;
    let ancora: number | null = null;
    let relogioPalavra: number | undefined;
    let relogioGato: number | undefined;
    let ponteiro = false, foco = false, piscadas = 0;
    const segurando = () => ponteiro || foco;
    function pausar() {
      clearTimeout(relogioPalavra);
      if (ancora !== null) decorrido += performance.now() - ancora;
      ancora = null;
    }
    function avancar() {
      if (parado()) return;
      const agora = performance.now();
      if (ancora !== null) decorrido += agora - ancora;
      ancora = agora;
      let sequencia = sequencias[fase];
      const duracao = sequencia.reduce((soma, [, ms]) => soma + ms, 0);
      if (decorrido >= duracao) {
        decorrido = fase === "onda" ? decorrido % duracao : 0;
        fase = "onda";
        sequencia = onda;
      }
      if (segurando() && fase === "onda") { mostrarPalavra(0); decorrido = 0; ancora = null; return; }
      let fim = 0;
      for (const [quadro, ms] of sequencia) {
        fim += ms;
        if (decorrido < fim) { mostrarPalavra(quadro); relogioPalavra = window.setTimeout(avancar, fim - decorrido); break; }
      }
    }
    function pressionar(origem: "ponteiro" | "foco") {
      const jaSegurava = segurando();
      if (origem === "ponteiro") ponteiro = true; else foco = true;
      if (jaSegurava || parado()) return;
      pausar(); fase = "tecla"; decorrido = 0; avancar();
    }
    function soltar(origem: "ponteiro" | "foco") {
      if (origem === "ponteiro") ponteiro = false; else foco = false;
      if (segurando() || parado()) return;
      pausar(); if (fase === "onda") decorrido = 0; avancar();
    }
    function piscar(espera: number) {
      if (parado()) return;
      const quadros = [1, 2, 1, 0];
      const passo = (i: number) => {
        mostrarGato(quadros[i]);
        if (i < quadros.length - 1) relogioGato = window.setTimeout(() => passo(i + 1), 80);
        else piscar(pausasPiscada[piscadas++ % pausasPiscada.length]);
      };
      relogioGato = window.setTimeout(() => { if (!parado()) passo(0); }, espera);
    }
    function reiniciar(doRepouso: boolean) {
      pausar(); clearTimeout(relogioGato); mostrarGato(0);
      if (doRepouso) { fase = "onda"; decorrido = 0; mostrarPalavra(0); }
      if (!parado()) { avancar(); piscar(5300); }
    }
    trocar.current = () => {
      pausar(); fase = "troca"; decorrido = 0;
      if (parado()) mostrarPalavra(0); else avancar();
    };
    const aoEntrar = (e: PointerEvent) => { if (e.pointerType !== "touch") pressionar("ponteiro"); };
    const aoSair = (e: PointerEvent) => { if (e.pointerType !== "touch") soltar("ponteiro"); };
    const aoFocar = () => pressionar("foco");
    const aoDesfocar = () => soltar("foco");
    const aoOcultar = () => reiniciar(false);
    const aoMudarMovimento = () => reiniciar(true);
    elLogo.addEventListener("pointerenter", aoEntrar);
    elLogo.addEventListener("pointerleave", aoSair);
    elLogo.addEventListener("focus", aoFocar);
    elLogo.addEventListener("blur", aoDesfocar);
    document.addEventListener("visibilitychange", aoOcultar);
    movimento.addEventListener("change", aoMudarMovimento);
    if (!parado()) { avancar(); piscar(640); }
    return () => {
      trocar.current = null;
      clearTimeout(relogioPalavra); clearTimeout(relogioGato);
      elLogo.removeEventListener("pointerenter", aoEntrar);
      elLogo.removeEventListener("pointerleave", aoSair);
      elLogo.removeEventListener("focus", aoFocar);
      elLogo.removeEventListener("blur", aoDesfocar);
      document.removeEventListener("visibilitychange", aoOcultar);
      movimento.removeEventListener("change", aoMudarMovimento);
      mostrarPalavra(0); mostrarGato(0);
    };
  }, []);
  useEffect(() => {
    if (caminhoAnterior.current === pathname) return;
    caminhoAnterior.current = pathname;
    trocar.current?.();
  }, [pathname]);
  return { logo, palavra, gato };
}

export function AcaoCabecalho({ children }: { children: ReactNode }) {
  const area = useContext(ContextoAcaoCabecalho);
  return area ? createPortal(children, area) : null;
}

export function Cabecalho({ emTarefas, areaAcaoRef }: { emTarefas: boolean; areaAcaoRef: Ref<HTMLDivElement> }) {
  const { logo, palavra, gato } = useLogoAnimado();
  const cabecalho = useRef<HTMLElement>(null);
  useEffect(() => {
    const atualizar = () => cabecalho.current?.toggleAttribute("data-rolada", window.scrollY > 0);
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    return () => window.removeEventListener("scroll", atualizar);
  }, []);
  const imagens = { "--e-top-gato": `url("${gatoEscuro}")`, "--e-top-logo": `url("${logoEscuro}")` } as CSSProperties;
  return <header ref={cabecalho} className="e-top">
    <Link ref={logo} className="e-logo" to="/" style={imagens}><span ref={gato} className="e-top-gato" aria-hidden="true" /><span ref={palavra} className="e-top-palavra" aria-hidden="true" /><span className="e-top-nome">Pixel</span></Link>
    <nav aria-label="Navegação principal"><Link to="/" aria-current={emTarefas ? "page" : undefined}><span>Tarefas</span></Link><NavLink to="/projetos"><span>Projetos</span></NavLink></nav>
    <div ref={areaAcaoRef} className="e-top-acao" />
  </header>;
}
