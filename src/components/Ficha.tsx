import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Heading } from "react-aria-components";
import { useLocation, useNavigate, type Location } from "react-router";
import { Button } from "@/components/base/buttons/button";
import {
  ModalOverlay,
  Modal,
  Dialog,
} from "@/components/application/modals/modal";
import { Icon } from "../design/icon";
import { useArrastarFicha } from "../hooks/useArrastarFicha";
import { useFolhaInferior } from "../hooks/useFolhaInferior";
import { useAncorarFicha } from "../hooks/useAncorarFicha";
import {
  chaveDoConteudo,
  ContextoFicha,
  ehRotaFicha,
  lembrarConteudo,
  tarefaDaFicha,
} from "./ficha-contexto";
import {
  descartarRetorno,
  marcarRetorno,
  primeiroVisivel,
  retornoPendente,
} from "../hooks/useRetornoFoco";
import "./AncoragemFicha.css";
import "./FolhaInferior.css";

function Presenca({
  aoSair,
  children,
}: {
  aoSair: () => void;
  children: ReactNode;
}) {
  useLayoutEffect(() => () => aoSair(), [aoSair]);
  return children;
}
export function Ficha({
  titulo,
  icone = "document",
  destinoFechar,
  fundo,
  origemInterna = false,
  classeModal,
  folhaInferior = false,
  children,
}: {
  titulo: string;
  icone?: string;
  destinoFechar: string;
  fundo: Location;
  origemInterna?: boolean;
  classeModal?: string;
  folhaInferior?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ref: cabecalho, ...arraste } = useArrastarFicha();
  // Presa à borda de baixo, a ficha não se move: o cabeçalho deixa de ser alça.
  const presa = useFolhaInferior(folhaInferior);
  const [aberta, setAberta] = useState(true);
  const [ocupada, setOcupada] = useState(false);
  const [alterada, setAlterada] = useState(false);
  const pendente = useRef<(() => void) | null>(null);
  const origem = useRef(
    document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
      ? document.activeElement
      : null,
  );
  const rolagem = useRef({
    caminho: fundo.pathname + fundo.search,
    y: window.scrollY,
  });
  useEffect(() => descartarRetorno(), []);
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
    if (/^\/tarefas\/(?!nova(?:\/|$))[^/]+\/?$/i.test(location.pathname)) {
      const frame = requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(".e-form-header button")
          ?.focus({ preventScroll: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [location.pathname]);
  const casca = useRef<HTMLDivElement>(null);
  const rotaFundo = fundo.pathname.replace(/\/+$/, "").toLowerCase() || "/";
  useAncorarFicha(
    casca,
    tarefaDaFicha(location.pathname),
    rotaFundo === "/quadro"
      ? "quadro"
      : rotaFundo === "/" || /^\/projetos\/[^/]+$/.test(rotaFundo)
        ? "lista"
        : undefined,
  );
  const ultimoFoco = useRef<HTMLElement | null>(null);
  const eraOcupada = useRef(false);
  useLayoutEffect(() => {
    // Sem a alça, o foco que estava nela vai para o botão de fechar. O
    // navegador pode já ter tirado o foco do cabeçalho quando o tabindex saiu.
    const alca = cabecalho.current;
    const ativo = document.activeElement;
    if (
      presa &&
      alca &&
      (ativo === alca ||
        (ultimoFoco.current === alca && (!ativo || ativo === document.body)))
    )
      alca.querySelector("button")?.focus({ preventScroll: true });
  }, [presa, cabecalho]);
  useEffect(() => {
    const voltou = eraOcupada.current && !ocupada;
    eraOcupada.current = ocupada;
    if (!voltou || !aberta) return;
    const recuperar = () => {
      const raiz = casca.current;
      const ativo = document.activeElement;
      if (!raiz?.isConnected || pendente.current) return;
      if (
        ativo &&
        ativo !== document.body &&
        ativo !== document.documentElement
      )
        return;
      const anterior = ultimoFoco.current;
      const alvo =
        anterior?.isConnected &&
        raiz.contains(anterior) &&
        !(anterior as HTMLButtonElement).disabled
          ? anterior
          : raiz.closest<HTMLElement>('[role="dialog"]');
      alvo?.focus({ preventScroll: true });
    };
    recuperar();
    const frame = requestAnimationFrame(recuperar);
    return () => cancelAnimationFrame(frame);
  }, [ocupada, aberta, location.pathname]);
  function navegar(
    destino: string,
    atualizar = false,
    estado?: object,
    alvos?: string[],
  ) {
    if (alvos) marcarRetorno(alvos, rolagem.current, origem.current);
    if (ehRotaFicha(destino.split("?")[0])) {
      const chave = `${chaveDoConteudo(fundo)}:atualizado`;
      if (atualizar) lembrarConteudo(fundo, chave);
      const fundoAtualizado = atualizar
        ? { ...fundo, state: { chaveConteudo: chave } }
        : fundo;
      navigate(destino, { state: { fundo: fundoAtualizado }, replace: true });
      return;
    }
    if (pendente.current) return;
    const tarefa = tarefaDaFicha(location.pathname);
    pendente.current = () => {
      const indice = window.history.state?.idx;
      const estadoDestino = atualizar
        ? (estado ?? null)
        : {
            chaveConteudo: chaveDoConteudo(fundo),
          };
      if (
        origemInterna &&
        destino === fundo.pathname + fundo.search &&
        Number.isInteger(indice) &&
        indice > 0
      ) {
        if (atualizar) {
          descartarRetorno();
          window.addEventListener(
            "popstate",
            () => {
              if (alvos) marcarRetorno(alvos, rolagem.current, origem.current);
              navigate(destino, { replace: true, state: estadoDestino });
            },
            { once: true },
          );
        }
        navigate(-1);
        if (atualizar) return;
      } else {
        navigate(destino, { replace: true, state: estadoDestino });
      }
      if (retornoPendente()) return;
      requestAnimationFrame(() => {
        const anterior = origem.current;
        if (anterior?.isConnected)
          return anterior.focus({ preventScroll: true });
        const alvo = primeiroVisivel([
          ...(tarefa
            ? [`[data-task-id="${CSS.escape(tarefa)}"] .e-task-title`]
            : []),
          '[data-action="new-task"]',
          '[data-action="new-project"]',
          "main h1",
        ]);
        if (!alvo) return;
        alvo.focus({ preventScroll: true });
        const caixa = alvo.getBoundingClientRect();
        const topo =
          document.querySelector(".e-top")?.getBoundingClientRect().bottom ?? 0;
        if (caixa.top < topo || caixa.bottom > window.innerHeight)
          alvo.scrollIntoView({ block: "center", inline: "nearest" });
      });
    };
    setAberta(false);
  }
  const fechar = () => {
    if (!ocupada && !document.querySelector(".e-splash"))
      navegar(destinoFechar);
  };
  return (
    <ContextoFicha.Provider
      value={{ navegar, fechar, destinoFechar, setOcupada, setAlterada }}
    >
      <ModalOverlay
        isOpen={aberta}
        onOpenChange={(valor) => {
          if (!valor) fechar();
        }}
        isDismissable={!ocupada && !alterada}
        isKeyboardDismissDisabled={ocupada}
        className={
          folhaInferior ? "e-form-overlay e-folha-overlay" : "e-form-overlay"
        }
      >
        <Modal
          className={[
            "e-form-modal",
            classeModal,
            folhaInferior && "e-folha",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <Dialog aria-label={titulo} className="e-form-dialog">
            <Presenca aoSair={concluirSaida}>
              <div
                className="e-form-shell"
                ref={casca}
                onFocusCapture={(e) => {
                  ultimoFoco.current = e.target as HTMLElement;
                }}
                aria-busy={ocupada}
              >
                <header
                  ref={cabecalho}
                  className="e-form-header"
                  {...(presa
                    ? null
                    : {
                        ...arraste,
                        tabIndex: 0,
                        "aria-label": "Mover ficha",
                        title: "Arraste para mover ou use as setas do teclado",
                      })}
                >
                  <div className="e-form-symbol">
                    <Icon name={icone} />
                  </div>
                  <Heading slot="title">{titulo}</Heading>
                  <Button
                    color="tertiary"
                    size="sm"
                    aria-label={`Fechar ${titulo.toLocaleLowerCase("pt-BR")}`}
                    onClick={fechar}
                    isDisabled={ocupada}
                  >
                    <Icon name="cross-small" />
                  </Button>
                </header>
                <div
                  className="e-ficha-content"
                  key={location.pathname + location.search}
                >
                  {children}
                </div>
              </div>
            </Presenca>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </ContextoFicha.Provider>
  );
}
