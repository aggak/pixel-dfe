import {
  Component,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  Autocomplete,
  Button as BotaoAria,
  Dialog,
  DialogTrigger,
  Input,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  RouterProvider,
  TextField,
} from "react-aria-components";
import { useConsulta } from "../hooks/useConsulta";
import { TituloPagina } from "../hooks/useTituloPagina";
import { Button } from "@/components/base/buttons/button";
import { BoardIcon, Icon, ListIcon, RefreshIcon } from "../design/icon";
import { statusTexto } from "../design/formatos";
import type { Projeto, Tarefa } from "../tipos";
import { ErroApi, ErroTempoEsgotado } from "../api";
import { GatinhoDormindo } from "./GatinhoDormindo";
import { GatinhoOlhando } from "./GatinhoOlhando";
import { GatinhoCostas } from "./GatinhoCostas";
import { GatinhoCarregando } from "./GatinhoCarregando";
import { Cabecalho } from "./Cabecalho";
import { ContextoAcaoCabecalho } from "./acao-cabecalho-contexto";
import { MarcaRodape } from "./MarcaRodape";
import {
  ALVOS_RESERVA,
  marcarVolta,
  primeiroVisivel,
} from "../hooks/useRetornoFoco";
import { comparavel, FILTROS_INICIAIS, type Filtros } from "../derivar";
import "./ComandoProjetos.css";

function caminhoNormalizado(pathname: string) {
  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}
function pularParaConteudo(evento: { preventDefault(): void }) {
  evento.preventDefault();
  const titulo = document.querySelector<HTMLElement>("main h1");
  const principal =
    titulo?.closest("main") ?? document.querySelector<HTMLElement>("main");
  const alvo = titulo ?? principal;
  if (!alvo || !principal) return;
  if (!alvo.hasAttribute("tabindex")) alvo.tabIndex = -1;
  const altura =
    document.querySelector(".e-top")?.getBoundingClientRect().height ?? 0;
  const limite = altura + 12;
  const caixa = principal.getBoundingClientRect();
  if (caixa.top < limite || caixa.top > window.innerHeight)
    window.scrollTo({
      top: Math.max(0, caixa.top + window.scrollY - limite),
      behavior: "instant",
    });
  alvo.focus({ preventScroll: true });
}
const rolagens = new Map<string, number>();
class FalhaPagina extends Component<
  { children: ReactNode },
  { falhou: boolean }
> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? (
      <>
        <TituloPagina titulo="Não foi possível mostrar esta página" />
        <main className="e-sheet">
          <div className="e-content">
            <ErroCarregamento
              titulo="Não foi possível mostrar esta página"
              erro={new SyntaxError()}
              onTentarDeNovo={() => window.location.reload()}
            />
          </div>
        </main>
      </>
    ) : (
      this.props.children
    );
  }
}
type DadosNavegacaoProjetos = {
  atual?: string;
  projetos: Omit<ReturnType<typeof useConsulta<Projeto[]>>, "refazer">;
  mostrarErro?: boolean;
};
const ContextoNavegacaoProjetos = createContext<Dispatch<
  SetStateAction<DadosNavegacaoProjetos | null>
> | null>(null);

export function Layout() {
  const [navegacaoProjetos, setNavegacaoProjetos] =
    useState<DadosNavegacaoProjetos | null>(null);
  const [areaAcao, setAreaAcao] = useState<HTMLDivElement | null>(null);
  const { pathname, key } = useLocation();
  const caminho = caminhoNormalizado(pathname);
  const chave = useRef(key);
  const emTarefas = caminho === "/" || caminho === "/quadro";
  useLayoutEffect(() => {
    chave.current = key;
  }, [key]);
  useEffect(() => {
    const guardar = () => rolagens.set(chave.current, window.scrollY);
    window.addEventListener("scroll", guardar, { passive: true });
    return () => window.removeEventListener("scroll", guardar);
  }, []);
  useLayoutEffect(() => {
    const y = rolagens.get(chave.current);
    if (y) marcarVolta(chave.current, y);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [caminho]);
  return (
    <div id="pixel-encaixe" className="e-app">
      <a className="e-pular" href="#conteudo" onClick={pularParaConteudo}>
        Pular para o conteúdo
      </a>
      <Cabecalho emTarefas={emTarefas} areaAcaoRef={setAreaAcao} />
      {navegacaoProjetos && <FaixaProjetos {...navegacaoProjetos} />}
      <ContextoAcaoCabecalho.Provider value={areaAcao}>
        <ContextoNavegacaoProjetos.Provider value={setNavegacaoProjetos}>
          <FalhaPagina key={caminho}>
            <Outlet />
          </FalhaPagina>
        </ContextoNavegacaoProjetos.Provider>
      </ContextoAcaoCabecalho.Provider>
      <footer className="e-footer" aria-label="Informações da Pixel">
        <div className="e-footer-row">
          <p className="e-footer-identity">
            <MarcaRodape />
            <span>Gerenciador de tarefas acadêmicas</span>
          </p>
          <span className="e-footer-context">
            Desenvolvimento Frontend · ULBRA · 2026.2
          </span>
        </div>
        <div className="e-footer-row">
          <nav className="e-footer-links" aria-label="Referências e créditos">
            <a
              href="https://github.com/aggak/pixel-dfe"
              target="_blank"
              rel="noreferrer"
            >
              Repositório
            </a>
            <a
              href={`${import.meta.env.BASE_URL}design-licenses/THIRD_PARTY_NOTICES.txt`}
              target="_blank"
              rel="noreferrer"
            >
              Créditos e licenças
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
function PixelArte({
  largura,
  altura,
  desenho,
}: {
  largura: number;
  altura: number;
  desenho: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura * 2}
      height={altura * 2}
      shapeRendering="crispEdges"
      focusable="false"
    >
      <path fill="currentColor" d={desenho} />
    </svg>
  );
}
const GRADE_TODAS = [0, 3, 6]
  .flatMap((y) => [0, 3, 6].map((x) => `M${x} ${y}h2v2h-2z`))
  .join("");
let ultimaLista: Projeto[] | undefined;
let ultimaVisao = "/";
export function NavegacaoProjetos({
  atual,
  projetos,
  mostrarErro = true,
}: DadosNavegacaoProjetos) {
  const setNavegacaoProjetos = useContext(ContextoNavegacaoProjetos);
  const { dados, erro, carregando, revalidando, tentando, tentarDeNovo } =
    projetos;
  useLayoutEffect(() => {
    setNavegacaoProjetos?.({
      atual,
      projetos: {
        dados,
        erro,
        carregando,
        revalidando,
        tentando,
        tentarDeNovo,
      },
      mostrarErro,
    });
    return () => setNavegacaoProjetos?.(null);
  }, [
    setNavegacaoProjetos,
    atual,
    dados,
    erro,
    carregando,
    revalidando,
    tentando,
    tentarDeNovo,
    mostrarErro,
  ]);
  return null;
}
function teclaDoComando(evento: KeyboardEvent, mac: boolean) {
  if (
    evento.defaultPrevented ||
    evento.repeat ||
    evento.isComposing ||
    !evento.altKey ||
    evento.ctrlKey ||
    evento.metaKey ||
    evento.shiftKey ||
    (!mac && evento.getModifierState("AltGraph"))
  ) {
    return false;
  }

  return (
    evento.key.toLowerCase() === "p" ||
    (mac &&
      evento.code === "KeyP" &&
      evento.key.length === 1 &&
      !/^[a-z]$/i.test(evento.key))
  );
}

function FaixaProjetos({ atual, projetos, mostrarErro = true }: DadosNavegacaoProjetos) {
  const location = useLocation();
  const navigate = useNavigate();
  const caminho = caminhoNormalizado(location.pathname);
  const naVisao = caminho === "/" || caminho === "/quadro";
  const [abertoEm, setAbertoEm] = useState<string>();
  const aberto = abertoEm === location.key;
  if (abertoEm && !aberto) setAbertoEm(undefined);
  const gatilho = useRef<HTMLButtonElement>(null);
  const atalhoId = useId();
  const mac = /^(Mac|iPad|iPhone|iPod)/.test(navigator.platform);

  useEffect(() => {
    if (naVisao) ultimaVisao = caminho;
  }, [naVisao, caminho]);
  useEffect(() => {
    if (projetos.dados) ultimaLista = projetos.dados;
  }, [projetos.dados]);

  const lista = projetos.dados ?? (projetos.carregando ? ultimaLista : undefined);
  const disponivel = Boolean(lista?.length);
  const rotulo = lista?.some((projeto) => projeto.id === atual)
    ? "Trocar projeto"
    : "Ir para projeto";
  const destinoTodas = naVisao ? caminho : ultimaVisao;
  const destinos = [
    { id: destinoTodas, nome: "Todas", atual: !atual },
    ...(lista ?? []).map((projeto) => ({
      id: `/projetos/${encodeURIComponent(projeto.id)}`,
      nome: projeto.nome || "Projeto sem nome",
      atual: projeto.id === atual,
    })),
  ];

  useEffect(() => {
    if (!disponivel) return;
    function abrirComTecla(evento: KeyboardEvent) {
      if (
        !teclaDoComando(evento, mac) ||
        document.querySelector(
          "#root[inert], [role=dialog][aria-modal=true], dialog[open]",
        ) ||
        (evento.target instanceof HTMLElement &&
          (evento.target.isContentEditable ||
            evento.target.closest(
              "input, textarea, select, [role=textbox], [role=combobox], [role=dialog]",
            )))
      ) {
        return;
      }

      evento.preventDefault();
      if (document.activeElement === document.body)
        gatilho.current?.focus({ preventScroll: true });
      setAbertoEm(location.key);
    }
    window.addEventListener("keydown", abrirComTecla);
    return () => window.removeEventListener("keydown", abrirComTecla);
  }, [disponivel, location.key, mac]);

  return (
    <nav className="e-projetos-comando" aria-label="Projetos">
      <Link
        className="e-projetos-comando-todas"
        to={destinoTodas}
        aria-current={!atual ? "page" : undefined}
      >
        <span aria-hidden="true">
          <PixelArte largura={8} altura={8} desenho={GRADE_TODAS} />
        </span>
        Todas
      </Link>
      {disponivel && (
        <DialogTrigger
          isOpen={aberto}
          onOpenChange={(abrir) => {
            if (abrir) gatilho.current?.focus({ preventScroll: true });
            setAbertoEm(abrir ? location.key : undefined);
          }}
        >
          <BotaoAria
            ref={gatilho}
            className="e-projetos-comando-gatilho"
            data-action="project-command"
            render={(props) => <button {...props} aria-keyshortcuts="Alt+P" />}
            aria-describedby={atalhoId}
          >
            <span>{rotulo}</span>
            <kbd aria-hidden="true">{mac ? "⌥ P" : "Alt + P"}</kbd>
          </BotaoAria>
          <ModalOverlay className="e-projetos-comando-veu" isDismissable>
            <Modal className="e-projetos-comando-caixa">
              <Dialog
                className="e-projetos-comando-dialogo"
                aria-label={rotulo}
              >
                <RouterProvider
                  navigate={(href) => {
                    setAbertoEm(undefined);
                    const atual = destinos.some(
                      (destino) => destino.id === href && destino.atual,
                    );
                    if (!atual) navigate(href);
                  }}
                >
                  <Autocomplete
                    filter={(nome, busca) =>
                      comparavel(nome).includes(comparavel(busca.trim()))
                    }
                  >
                    <TextField
                      className="e-projetos-comando-busca"
                      aria-label="Buscar projeto"
                      autoFocus
                    >
                      <Input placeholder="Buscar projeto…" enterKeyHint="go" />
                      <BotaoAria
                        className="e-projetos-comando-fechar"
                        aria-label="Fechar"
                        onPress={() => setAbertoEm(undefined)}
                      >
                        <Icon name="cross-small" />
                      </BotaoAria>
                    </TextField>
                    <ListBox
                      aria-label="Projetos"
                      className="e-projetos-comando-resultados"
                      items={destinos}
                      renderEmptyState={() => <p>Nenhum projeto encontrado.</p>}
                    >
                      {(destino) => (
                        <ListBoxItem
                          id={destino.id}
                          textValue={destino.nome}
                          className="e-projetos-comando-opcao"
                          data-atual={destino.atual ? "" : undefined}
                          aria-label={
                            destino.atual ? `${destino.nome} (atual)` : destino.nome
                          }
                          href={destino.id}
                        >
                          <Icon
                            name={destino.id === destinoTodas ? "list" : "folder"}
                          />
                          <span>{destino.nome}</span>
                          {destino.atual && <Icon name="check" />}
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Autocomplete>
                </RouterProvider>
                <div className="e-projetos-comando-teclas" aria-hidden="true">
                  <span>
                    <kbd>↑</kbd> <kbd>↓</kbd> navegar
                  </span>
                  <span>
                    <kbd>Enter</kbd> abrir
                  </span>
                  <span>
                    <kbd>Esc</kbd> fechar
                  </span>
                </div>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      )}
      <span id={atalhoId} hidden>
        Atalho {mac ? "Option + P" : "Alt + P"}
      </span>
      {projetos.carregando && !lista && (
        <Carregando compacto>Carregando projetos…</Carregando>
      )}
      {mostrarErro && projetos.erro !== undefined && (
        <AvisoCompacto
          texto="Os projetos não carregaram."
          tentando={projetos.tentando}
          onTentarDeNovo={projetos.tentarDeNovo}
        />
      )}
    </nav>
  );
}
const visoes = [
  { destino: "/", nome: "Lista", Icone: ListIcon },
  { destino: "/quadro", nome: "Quadro", Icone: BoardIcon },
];
export function AlternarVisao() {
  const location = useLocation();
  const caminho = caminhoNormalizado(location.pathname);
  const ativo = useRef<HTMLAnchorElement>(null);
  const veioDoControle = (location.state as { focoVisao?: boolean } | null)
    ?.focoVisao;
  useEffect(() => {
    if (veioDoControle) ativo.current?.focus({ preventScroll: true });
  }, [veioDoControle]);
  return (
    <nav className="e-view-switch" aria-label="Visualização das tarefas">
      {visoes.map(({ destino, nome, Icone }) => {
        const atual = caminho === destino;
        return (
          <Link
            key={destino}
            ref={atual ? ativo : undefined}
            to={destino}
            state={{ focoVisao: true }}
            aria-current={atual ? "page" : undefined}
          >
            <Icone />
            {nome}
          </Link>
        );
      })}
    </nav>
  );
}
function fraseResultados(n: number) {
  return `${n} ${n === 1 ? "tarefa encontrada" : "tarefas encontradas"}.`;
}
export function AnuncioResultados({
  total,
  filtros,
}: {
  total: number;
  filtros: Filtros;
}) {
  const [texto, setTexto] = useState("");
  const chave = JSON.stringify(filtros);
  const anterior = useRef(chave);
  const totalAtual = useRef(total);
  const anunciado = useRef<number | null>(null);
  const pendente = useRef(false);
  const ativos =
    filtros.busca !== FILTROS_INICIAIS.busca ||
    filtros.status !== FILTROS_INICIAIS.status ||
    filtros.prioridade !== FILTROS_INICIAIS.prioridade;
  useEffect(() => {
    totalAtual.current = total;
  }, [total]);
  useEffect(() => {
    if (anterior.current === chave) return;
    anterior.current = chave;
    pendente.current = true;
    const espera = setTimeout(() => {
      pendente.current = false;
      const n = totalAtual.current;
      anunciado.current = n;
      setTexto(fraseResultados(n));
    }, 700);
    return () => {
      clearTimeout(espera);
      pendente.current = false;
    };
  }, [chave]);
  useEffect(() => {
    if (
      pendente.current ||
      anunciado.current === null ||
      anunciado.current === total
    )
      return;
    anunciado.current = total;
    if (!ativos) return;
    const n = total;
    let vigente = true;
    queueMicrotask(() => {
      if (vigente) setTexto(fraseResultados(n));
    });
    return () => {
      vigente = false;
    };
  }, [total, ativos]);
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {texto}
    </p>
  );
}
export function Carregando({
  children,
  compacto = false,
}: {
  children: string;
  compacto?: boolean;
}) {
  return (
    <div
      className={`e-loading-state${compacto ? " e-loading-compact" : ""}`}
      role="status"
    >
      {compacto ? (
        <span className="e-loading-dot" aria-hidden="true" />
      ) : (
        <GatinhoCarregando />
      )}
      {children}
    </div>
  );
}
function useDevolverFoco<T extends HTMLElement>() {
  const raiz = useRef<T>(null);
  useLayoutEffect(() => {
    const elemento = raiz.current;
    return () => {
      if (!elemento?.contains(document.activeElement)) return;
      const alvo = elemento.closest<HTMLElement>('[role="dialog"]');
      requestAnimationFrame(() => {
        const ativo = document.activeElement;
        if (!ativo || ativo === document.body || !ativo.isConnected)
          (alvo?.isConnected ? alvo : primeiroVisivel(ALVOS_RESERVA))?.focus({
            preventScroll: true,
          });
      });
    };
  }, []);
  return raiz;
}
export function ErroCarregamento({
  titulo,
  erro,
  onTentarDeNovo,
  tentando = false,
  compacto = false,
}: {
  titulo: string;
  erro?: unknown;
  onTentarDeNovo: () => void;
  tentando?: boolean;
  compacto?: boolean;
}) {
  const raiz = useDevolverFoco<HTMLDivElement>();
  const motivo =
    erro instanceof ErroTempoEsgotado
      ? erro.message
      : erro instanceof ErroApi ||
          (erro instanceof Error && erro.name === "SyntaxError")
        ? "O servidor encontrou um problema. Tente de novo em instantes."
        : "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
  return (
    <div
      ref={raiz}
      className={`e-load-error${compacto ? " e-load-error-compact" : ""}`}
      role="alert"
    >
      <GatinhoCostas />
      <h2>{titulo}</h2>
      <p>{tentando ? "Tentando de novo…" : motivo}</p>
      <Button
        color="secondary"
        size="sm"
        iconLeading={RefreshIcon}
        isLoading={tentando}
        onClick={onTentarDeNovo}
      >
        Tentar de novo
      </Button>
    </div>
  );
}
export function AvisoCompacto({
  texto,
  onTentarDeNovo,
  tentando = false,
}: {
  texto: string;
  onTentarDeNovo: () => void;
  tentando?: boolean;
}) {
  const raiz = useDevolverFoco<HTMLSpanElement>();
  return (
    <span ref={raiz} className="e-inline-error" role="status">
      <Icon name="cloud-disabled" />
      <span className="e-inline-error-text">
        {tentando ? "Tentando de novo…" : texto}
      </span>
      <Button
        color="link-color"
        size="sm"
        iconLeading={RefreshIcon}
        isLoading={tentando}
        showTextWhileLoading
        onClick={onTentarDeNovo}
      >
        Tentar de novo
      </Button>
    </span>
  );
}
function focarBuscaSePerdido() {
  requestAnimationFrame(() => {
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body || !ativo.isConnected)
      primeiroVisivel(ALVOS_RESERVA)?.focus();
  });
}
export function AvisoTarefaEscondida({
  tarefas,
  exibidas,
  onLimpar,
  saiu,
  projetoAtual,
}: {
  tarefas: Tarefa[];
  exibidas: Tarefa[];
  onLimpar?: () => void;
  saiu?: Tarefa;
  projetoAtual?: string;
}) {
  const estado = useLocation().state as {
    tarefaCriada?: string;
    projetoCriado?: string;
  } | null;
  const criada = estado?.tarefaCriada;
  const saida =
    saiu &&
    tarefas.some((tarefa) => tarefa.id === saiu.id) &&
    !exibidas.some((tarefa) => tarefa.id === saiu.id)
      ? saiu
      : undefined;
  const outroProjeto =
    projetoAtual !== undefined &&
    criada !== undefined &&
    estado?.projetoCriado !== undefined &&
    estado.projetoCriado !== projetoAtual &&
    !tarefas.some((tarefa) => tarefa.id === criada)
      ? estado.projetoCriado
      : undefined;
  const escondida =
    criada !== undefined &&
    tarefas.some((tarefa) => tarefa.id === criada) &&
    !exibidas.some((tarefa) => tarefa.id === criada);
  const texto = saida
    ? `“${saida.titulo}” agora está em ${statusTexto[saida.status]} e saiu deste filtro.`
    : outroProjeto !== undefined
      ? "Tarefa criada em outro projeto."
      : escondida
        ? "Tarefa criada, mas escondida pela busca ou pelos filtros."
        : undefined;
  return (
    <div aria-live="polite" aria-atomic="true">
      {texto && (
        <p className="e-hidden-notice">
          <Icon name="eye-crossed" />
          <span>{texto}</span>
          {outroProjeto !== undefined && (
            <Link to={`/projetos/${encodeURIComponent(outroProjeto)}`}>
              Ver o projeto
            </Link>
          )}
          {onLimpar && exibidas.length > 0 && outroProjeto === undefined && (
            <Button
              color="link-color"
              size="sm"
              onClick={() => {
                onLimpar();
                focarBuscaSePerdido();
              }}
            >
              Limpar busca e filtros
            </Button>
          )}
        </p>
      )}
    </div>
  );
}
export function EstadoVazio({
  titulo,
  descricao,
  acao,
  gato = "dormindo",
  destino,
  onAcao,
}: {
  titulo: string;
  descricao?: string;
  acao: string;
  gato?: "dormindo" | "olhando";
  destino?: string;
  onAcao?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const agir = () => {
    onAcao?.();
    focarBuscaSePerdido();
  };
  return (
    <div className="e-empty">
      {gato === "olhando" ? <GatinhoOlhando /> : <GatinhoDormindo />}
      <h2>{titulo}</h2>
      {descricao && <p>{descricao}</p>}
      <Button
        color={destino ? "primary" : "secondary"}
        size="sm"
        onClick={() =>
          destino ? navigate(destino, { state: { fundo: location } }) : agir()
        }
      >
        {acao}
      </Button>
    </div>
  );
}
