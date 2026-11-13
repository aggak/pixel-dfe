import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useConsulta } from "../hooks/useConsulta";
import { TituloPagina } from "../hooks/useTituloPagina";
import { Button } from "@/components/base/buttons/button";
import { BoardIcon, Icon, ListIcon, RefreshIcon } from "../design/icon";
import type { Projeto, Tarefa } from "../tipos";
import { ErroApi, ErroTempoEsgotado } from "../api";
import { GatinhoDormindo } from "./GatinhoDormindo";
import { GatinhoOlhando } from "./GatinhoOlhando";
import { GatinhoCostas } from "./GatinhoCostas";
import { GatinhoCarregando } from "./GatinhoCarregando";
import { Cabecalho } from "./Cabecalho";
import { ContextoAcaoCabecalho } from "./acao-cabecalho-contexto";
import { MarcaRodape } from "./MarcaRodape";
import { Monograma } from "./CartaoProjeto";
import { ALVOS_RESERVA, primeiroVisivel } from "../hooks/useRetornoFoco";

// Caminho como o roteador casa as rotas: sem barra final e sem diferença de maiúsculas.
function caminhoNormalizado(pathname: string) {
  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}
class FalhaPagina extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    return this.state.falhou ? <><TituloPagina titulo="Não foi possível mostrar esta página" /><main className="e-sheet"><div className="e-content"><ErroCarregamento titulo="Não foi possível mostrar esta página" erro={new SyntaxError()} onTentarDeNovo={() => window.location.reload()} /></div></main></> : this.props.children;
  }
}
export function Layout() {
  const [areaAcao, setAreaAcao] = useState<HTMLDivElement | null>(null);
  const caminho = caminhoNormalizado(useLocation().pathname);
  // Lista e quadro são duas visões da mesma seção: "Tarefas" fica marcado nas duas.
  const emTarefas = caminho === "/" || caminho === "/quadro";
  return <div id="pixel-encaixe" className="e-app">
    <Cabecalho emTarefas={emTarefas} areaAcaoRef={setAreaAcao} />
    <ContextoAcaoCabecalho.Provider value={areaAcao}><FalhaPagina key={caminho}><Outlet /></FalhaPagina></ContextoAcaoCabecalho.Provider>
    <footer className="e-footer" aria-label="Informações da Pixel"><div className="e-footer-row"><p className="e-footer-identity"><MarcaRodape /><span>Gerenciador de tarefas acadêmicas</span></p><span className="e-footer-context">Desenvolvimento Frontend · ULBRA · 2026.2</span></div><div className="e-footer-row"><nav className="e-footer-links" aria-label="Referências e créditos"><a href="https://github.com/aggak/pixel-dfe" target="_blank" rel="noreferrer">Repositório</a><a href="https://www.untitledui.com/react/components" target="_blank" rel="noreferrer">Componentes Untitled UI</a><a href={`${import.meta.env.BASE_URL}design-licenses/THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Licenças</a></nav></div></footer>
  </div>;
}
function PixelArte({ largura, altura, desenho }: { largura: number; altura: number; desenho: string }) {
  return <svg viewBox={`0 0 ${largura} ${altura}`} width={largura * 2} height={altura * 2} shapeRendering="crispEdges" focusable="false"><path fill="currentColor" d={desenho} /></svg>;
}
const GRADE_TODAS = [0, 3, 6].flatMap((y) => [0, 3, 6].map((x) => `M${x} ${y}h2v2h-2z`)).join("");
const SETAS = {
  ini: "M3 0h1v1h-1zM2 1h1v1h-1zM1 2h1v1h-1zM0 3h1v1h-1zM1 4h1v1h-1zM2 5h1v1h-1zM3 6h1v1h-1z",
  fim: "M0 0h1v1h-1zM1 1h1v1h-1zM2 2h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1zM1 5h1v1h-1zM0 6h1v1h-1z",
};
let ultimaLista: Projeto[] | undefined;
let ultimaVisao = "/";
export function AbasProjetos({ atual, projetos, mostrarErro = true }: { atual?: string; projetos: ReturnType<typeof useConsulta<Projeto[]>>; mostrarErro?: boolean }) {
  const fileira = useRef<HTMLElement>(null);
  const caminho = caminhoNormalizado(useLocation().pathname);
  const naVisao = caminho === "/" || caminho === "/quadro";
  useEffect(() => { if (naVisao) ultimaVisao = caminho; }, [naVisao, caminho]);
  useEffect(() => { if (projetos.dados) ultimaLista = projetos.dados; }, [projetos.dados]);
  const lista = projetos.dados ?? (projetos.carregando ? ultimaLista : undefined);
  const total = lista?.length ?? 0;
  // Quando as abas não cabem, a fileira rola por dentro: data-sobra diz ao CSS de que lado há abas escondidas
  // (esmaecimento e setas) e a aba atual é trazida para a vista. "Todas" fica presa à esquerda.
  useEffect(() => {
    const nav = fileira.current;
    const todas = nav?.querySelector<HTMLElement>("a");
    if (!nav || !todas) return;
    const medir = () => {
      nav.style.setProperty("--aba-todas", `${todas.offsetWidth}px`);
      const resto = nav.scrollWidth - nav.clientWidth - nav.scrollLeft;
      nav.dataset.sobra = `${nav.scrollLeft > 2 ? "ini" : ""} ${resto > 2 ? "fim" : ""}`.trim();
    };
    const mostrarAtual = () => {
      medir();
      const aba = nav.querySelector<HTMLElement>("a[aria-current]");
      if (!aba || aba === todas) return;
      const folga = matchMedia("(max-width: 650px)").matches ? 26 : 60;
      const inicio = aba.offsetLeft - todas.offsetWidth - folga;
      const fim = aba.offsetLeft + aba.offsetWidth + folga - nav.clientWidth;
      const alvo = nav.scrollLeft > inicio ? inicio : nav.scrollLeft < fim ? Math.min(fim, inicio) : nav.scrollLeft;
      nav.scrollTo({ left: Math.max(alvo, 0), behavior: "auto" });
    };
    mostrarAtual();
    document.fonts?.ready.then(mostrarAtual);
    nav.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(mostrarAtual);
    observador.observe(nav);
    return () => { nav.removeEventListener("scroll", medir); observador.disconnect(); };
  }, [atual, total]);
  const rolar = (sentido: number) => {
    const nav = fileira.current;
    nav?.scrollBy({ left: sentido * Math.max(nav.clientWidth * 0.6, 160), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const seta = (lado: "ini" | "fim") => <button type="button" className="e-tabs-seta" data-lado={lado} aria-hidden="true" tabIndex={-1} onClick={() => rolar(lado === "ini" ? -1 : 1)}><PixelArte largura={4} altura={7} desenho={SETAS[lado]} /></button>;
  return <nav ref={fileira} className="e-tabs" aria-label="Projetos"><Link to={naVisao ? caminho : ultimaVisao} aria-current={!atual ? "page" : undefined}><span className="e-tabs-mono" aria-hidden="true"><PixelArte largura={8} altura={8} desenho={GRADE_TODAS} /></span><span className="e-tabs-nome">Todas</span></Link>{seta("ini")}{projetos.carregando && !lista && <Carregando compacto>Carregando projetos…</Carregando>}{mostrarErro && projetos.erro !== undefined && <AvisoCompacto texto="Os projetos não carregaram." tentando={projetos.tentando} onTentarDeNovo={projetos.tentarDeNovo} />}{lista?.map((projeto) => <Link key={projeto.id} to={`/projetos/${encodeURIComponent(projeto.id)}`} title={projeto.nome} aria-current={atual === projeto.id ? "page" : undefined}><Monograma nome={projeto.nome} className="e-tabs-mono" /><span className="e-tabs-nome">{projeto.nome}</span></Link>)}{seta("fim")}</nav>;
}
const visoes = [{ destino: "/", nome: "Lista", Icone: ListIcon }, { destino: "/quadro", nome: "Quadro", Icone: BoardIcon }];
// Links, e não botões: cada visão tem sua rota. Busca e filtros ficam no FiltrosProvider, acima das rotas, e sobrevivem à troca.
export function AlternarVisao() {
  const location = useLocation();
  const caminho = caminhoNormalizado(location.pathname);
  const ativo = useRef<HTMLAnchorElement>(null);
  // A troca remonta a página; quem alternou pelo controle continua com o foco nele, agora no link da nova visão.
  const veioDoControle = (location.state as { focoVisao?: boolean } | null)?.focoVisao;
  useEffect(() => { if (veioDoControle) ativo.current?.focus({ preventScroll: true }); }, [veioDoControle]);
  return <nav className="e-view-switch" aria-label="Visualização das tarefas">{visoes.map(({ destino, nome, Icone }) => {
    const atual = caminho === destino;
    return <Link key={destino} ref={atual ? ativo : undefined} to={destino} state={{ focoVisao: true }} aria-current={atual ? "page" : undefined}><Icone />{nome}</Link>;
  })}</nav>;
}
export function AnuncioResultados({ total, filtros }: { total: number; filtros: object }) {
  const [texto, setTexto] = useState("");
  const chave = JSON.stringify(filtros);
  const anterior = useRef(chave);
  const totalAtual = useRef(total);
  useEffect(() => { totalAtual.current = total; }, [total]);
  useEffect(() => {
    if (anterior.current === chave) return;
    anterior.current = chave;
    const espera = setTimeout(() => {
      const n = totalAtual.current;
      setTexto(`${n} ${n === 1 ? "tarefa encontrada" : "tarefas encontradas"}.`);
    }, 700);
    return () => clearTimeout(espera);
  }, [chave]);
  return <p className="sr-only" aria-live="polite" aria-atomic="true">{texto}</p>;
}
export function Carregando({ children, compacto = false }: { children: string; compacto?: boolean }) {
  return <div className={`e-loading-state${compacto ? " e-loading-compact" : ""}`} role="status">{compacto ? <span className="e-loading-dot" aria-hidden="true" /> : <GatinhoCarregando />}{children}</div>;
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
        if (!ativo || ativo === document.body || !ativo.isConnected) (alvo?.isConnected ? alvo : primeiroVisivel(ALVOS_RESERVA))?.focus({ preventScroll: true });
      });
    };
  }, []);
  return raiz;
}
export function ErroCarregamento({ titulo, erro, onTentarDeNovo, tentando = false, compacto = false }: { titulo: string; erro?: unknown; onTentarDeNovo: () => void; tentando?: boolean; compacto?: boolean }) {
  const raiz = useDevolverFoco<HTMLDivElement>();
  const motivo = erro instanceof ErroTempoEsgotado ? erro.message : erro instanceof ErroApi || (erro instanceof Error && erro.name === "SyntaxError") ? "O servidor encontrou um problema. Tente de novo em instantes." : "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
  return <div ref={raiz} className={`e-load-error${compacto ? " e-load-error-compact" : ""}`} role="alert"><GatinhoCostas /><h2>{titulo}</h2><p>{tentando ? "Tentando de novo…" : motivo}</p><Button color="secondary" size="sm" iconLeading={RefreshIcon} isLoading={tentando} onClick={onTentarDeNovo}>Tentar de novo</Button></div>;
}
export function AvisoCompacto({ texto, onTentarDeNovo, tentando = false }: { texto: string; onTentarDeNovo: () => void; tentando?: boolean }) {
  const raiz = useDevolverFoco<HTMLSpanElement>();
  return <span ref={raiz} className="e-inline-error" role="status"><Icon name="cloud-disabled" /><span className="e-inline-error-text">{tentando ? "Tentando de novo…" : texto}</span><Button color="link-color" size="sm" iconLeading={RefreshIcon} isLoading={tentando} showTextWhileLoading onClick={onTentarDeNovo}>Tentar de novo</Button></span>;
}
function focarBuscaSePerdido() {
  requestAnimationFrame(() => {
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body || !ativo.isConnected) primeiroVisivel(ALVOS_RESERVA)?.focus();
  });
}
export function AvisoTarefaEscondida({ tarefas, exibidas, onLimpar }: { tarefas: Tarefa[]; exibidas: Tarefa[]; onLimpar: () => void }) {
  const criada = (useLocation().state as { tarefaCriada?: string } | null)?.tarefaCriada;
  const escondida = criada !== undefined && tarefas.some((tarefa) => tarefa.id === criada) && !exibidas.some((tarefa) => tarefa.id === criada);
  return <div aria-live="polite" aria-atomic="true">{escondida && <p className="e-hidden-notice"><Icon name="eye-crossed" /><span>Tarefa criada, mas escondida pela busca ou pelos filtros.</span>{exibidas.length > 0 && <Button color="link-color" size="sm" onClick={() => { onLimpar(); focarBuscaSePerdido(); }}>Limpar busca e filtros</Button>}</p>}</div>;
}
export function EstadoVazio({ titulo, descricao, acao, icone = "folder", destino, onAcao }: { titulo: string; descricao?: string; acao: string; icone?: string; destino?: string; onAcao?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const agir = () => {
    onAcao?.();
    focarBuscaSePerdido();
  };
  return <div className="e-empty">{icone === "search" ? <GatinhoOlhando /> : <GatinhoDormindo />}<h2>{titulo}</h2>{descricao && <p>{descricao}</p>}<Button color={destino ? "primary" : "secondary"} size="sm" onClick={() => (destino ? navigate(destino, { state: { fundo: location } }) : agir())}>{acao}</Button></div>;
}
