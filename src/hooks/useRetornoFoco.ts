import { useContext, useEffect } from "react";
import { useLocation } from "react-router";
import { ContextoPaginaAtiva } from "./useTituloPagina";

export const ALVOS_RESERVA = [".e-task-search input", "main h1", '[data-action="new-task"]', '[data-action="new-project"]'];

type Retorno = { origem?: HTMLElement | null; alvos: string[]; rolagem: { caminho: string; y: number } };
let retorno: Retorno | null = null;

export function marcarRetorno(alvos: string[], rolagem: Retorno["rolagem"], origem?: HTMLElement | null) {
  retorno = { alvos, rolagem, origem };
}
export function descartarRetorno() {
  retorno = null;
}
export function retornoPendente() {
  return retorno !== null;
}

export function primeiroVisivel(seletores: string[]) {
  for (const seletor of seletores) {
    const alvo = document.querySelector<HTMLElement>(seletor);
    const caixa = alvo?.getBoundingClientRect();
    if (alvo && caixa && caixa.width > 1 && caixa.height > 1) return alvo;
  }
  return null;
}

export function useRetornoFoco(pronto: boolean) {
  const ativa = useContext(ContextoPaginaAtiva);
  const { pathname, search } = useLocation();
  useEffect(() => {
    const atual = retorno;
    if (!pronto || !atual) return;
    if (atual.rolagem.caminho === pathname + search) window.scrollTo({ top: atual.rolagem.y, behavior: "instant" });
    if (!ativa) return;
    retorno = null;
    const foco = document.activeElement;
    const alvo = primeiroVisivel([...atual.alvos, ...ALVOS_RESERVA]);
    if (!alvo) return;
    const menuDoCartao = foco?.matches(".e-task-menu") && alvo.closest("[data-task-id]")?.contains(foco);
    if (foco && foco !== document.body && foco !== document.documentElement && foco.isConnected && foco !== atual.origem && !menuDoCartao) return;
    const caixa = alvo.getBoundingClientRect();
    const topo = document.querySelector(".e-top")?.getBoundingClientRect().bottom ?? 0;
    if (caixa.top < topo || caixa.bottom > window.innerHeight) alvo.scrollIntoView({ block: "center", inline: "nearest" });
    alvo.focus({ preventScroll: true });
  }, [pronto, ativa, pathname, search]);
}
