import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Heading } from "react-aria-components";
import { useLocation, useNavigate, type Location } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { Icon } from "../design/icon";
import { ContextoFicha, ehRotaFicha, type EstadoFicha } from "./ficha-contexto";

function Presenca({ aoSair, children }: { aoSair: () => void; children: ReactNode }) {
  useLayoutEffect(() => () => aoSair(), [aoSair]);
  return children;
}
export function Ficha({ titulo, icone = "document", destinoFechar, fundo, origemInterna = false, children }: { titulo: string; icone?: string; destinoFechar: string; fundo: Location; origemInterna?: boolean; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [aberta, setAberta] = useState(true);
  const [ocupada, setOcupada] = useState(false);
  const pendente = useRef<(() => void) | null>(null);
  const origem = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const concluirSaida = useCallback(() => {
    const continuar = pendente.current;
    pendente.current = null;
    if (continuar) queueMicrotask(continuar);
  }, []);
  useEffect(() => {
    const cancelarSaida = () => {
      if (!pendente.current) return;
      pendente.current = null;
      setAberta(true);
    };
    window.addEventListener("popstate", cancelarSaida);
    return () => window.removeEventListener("popstate", cancelarSaida);
  }, []);
  useLayoutEffect(() => {
    if (/^\/tarefas\/(?!nova(?:\/|$))[^/]+\/?$/.test(location.pathname)) {
      const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(".e-form-header button")?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [location.pathname]);
  const casca = useRef<HTMLDivElement>(null);
  const ultimoFoco = useRef<HTMLElement | null>(null);
  const eraOcupada = useRef(false);
  useEffect(() => {
    const voltou = eraOcupada.current && !ocupada;
    eraOcupada.current = ocupada;
    if (!voltou || !aberta) return;
    // Controle desabilitado durante o envio faz o foco cair no body; recupera sem roubar foco válido.
    const recuperar = () => {
      const raiz = casca.current;
      const ativo = document.activeElement;
      if (!raiz?.isConnected || pendente.current) return;
      if (ativo && ativo !== document.body && ativo !== document.documentElement) return;
      const anterior = ultimoFoco.current;
      const alvo = anterior?.isConnected && raiz.contains(anterior) && !(anterior as HTMLButtonElement).disabled ? anterior : raiz.closest<HTMLElement>('[role="dialog"]');
      alvo?.focus({ preventScroll: true });
    };
    recuperar();
    const frame = requestAnimationFrame(recuperar);
    return () => cancelAnimationFrame(frame);
  }, [ocupada, aberta, location.pathname]);
  function navegar(destino: string, atualizar = false) {
    if (ehRotaFicha(destino.split("?")[0])) {
      const fundoAtualizado = atualizar ? { ...fundo, state: { chaveConteudo: `${(fundo.state as EstadoFicha | null)?.chaveConteudo ?? fundo.key}:atualizado` } } : fundo;
      navigate(destino, { state: { fundo: fundoAtualizado }, replace: true });
      return;
    }
    if (pendente.current) return;
    pendente.current = () => {
      // Só percorre o histórico quando a própria aplicação registrou a origem.
      const indice = window.history.state?.idx;
      if (!atualizar && origemInterna && destino === fundo.pathname + fundo.search && Number.isInteger(indice) && indice > 0) {
        navigate(-1);
      } else {
        navigate(destino, { replace: true, state: atualizar ? null : { chaveConteudo: (fundo.state as EstadoFicha | null)?.chaveConteudo ?? fundo.key } });
      }
      requestAnimationFrame(() => {
        const anterior = origem.current;
        if (anterior?.isConnected) anterior.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('[data-action="new-task"], [data-action="new-project"], main h1')?.focus({ preventScroll: true });
      });
    };
    setAberta(false);
  }
  const fechar = () => { if (!ocupada) navegar(destinoFechar); };
  return <ContextoFicha.Provider value={{ navegar, fechar, setOcupada }}>
    <ModalOverlay isOpen={aberta} onOpenChange={(valor) => { if (!valor) fechar(); }} isDismissable={!ocupada} isKeyboardDismissDisabled={ocupada} className="e-form-overlay">
      <Modal className="e-form-modal"><Dialog aria-label={titulo} className="e-form-dialog">
        <Presenca aoSair={concluirSaida}><div className="e-form-shell" ref={casca} onFocusCapture={(e) => { ultimoFoco.current = e.target as HTMLElement; }} aria-busy={ocupada}>
          <header className="e-form-header"><div className="e-form-symbol"><Icon name={icone} /></div><Heading slot="title">{titulo}</Heading><Button color="tertiary" size="sm" aria-label={`Fechar ${titulo.toLocaleLowerCase("pt-BR")}`} onClick={fechar} isDisabled={ocupada}><Icon name="cross-small" /></Button></header>
          <div className="e-ficha-content" key={location.pathname + location.search}>{children}</div>
        </div></Presenca>
      </Dialog></Modal>
    </ModalOverlay>
  </ContextoFicha.Provider>;
}
