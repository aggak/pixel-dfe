import { useEffect, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useConsulta } from "../hooks/useConsulta";
import { Button } from "@/components/base/buttons/button";
import { BoardIcon, Icon, ListIcon, RefreshIcon } from "../design/icon";
import type { Projeto } from "../tipos";
import { ErroApi } from "../api";
import { GatinhoDormindo } from "./GatinhoDormindo";
import { GatinhoOlhando } from "./GatinhoOlhando";
import { GatinhoCostas } from "./GatinhoCostas";
import { GatinhoCarregando } from "./GatinhoCarregando";
import { Cabecalho } from "./Cabecalho";
import { MarcaRodape } from "./MarcaRodape";
import { Monograma } from "./CartaoProjeto";

// Caminho como o roteador casa as rotas: sem barra final e sem diferença de maiúsculas.
function caminhoNormalizado(pathname: string) {
  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}
export function Layout() {
  const caminho = caminhoNormalizado(useLocation().pathname);
  // Lista e quadro são duas visões da mesma seção: "Tarefas" fica marcado nas duas.
  const emTarefas = caminho === "/" || caminho === "/quadro";
  return <div id="pixel-encaixe" className="e-app">
    <Cabecalho emTarefas={emTarefas} />
    <Outlet />
    <footer className="e-footer" aria-label="Informações da Pixel"><div className="e-footer-row"><p className="e-footer-identity"><MarcaRodape /><span>Gerenciador de tarefas acadêmicas</span></p><span className="e-footer-context">Desenvolvimento Frontend · ULBRA · 2026.2</span></div><div className="e-footer-row"><nav className="e-footer-links" aria-label="Referências e créditos"><a href="https://github.com/aggak/pixel-dfe" target="_blank" rel="noreferrer">Repositório</a><a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Uicons por Flaticon</a><a href="https://www.untitledui.com/react/components" target="_blank" rel="noreferrer">Componentes Untitled UI</a><a href={`${import.meta.env.BASE_URL}design-licenses/THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Licenças</a></nav></div></footer>
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
  if (caminho === "/" || caminho === "/quadro") ultimaVisao = caminho;
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
  return <nav ref={fileira} className="e-tabs" aria-label="Projetos"><Link to={ultimaVisao} aria-current={!atual ? "page" : undefined}><span className="e-tabs-mono" aria-hidden="true"><PixelArte largura={8} altura={8} desenho={GRADE_TODAS} /></span><span className="e-tabs-nome">Todas</span></Link>{seta("ini")}{projetos.carregando && !lista && <Carregando compacto>Carregando projetos…</Carregando>}{mostrarErro && projetos.erro !== undefined && <AvisoCompacto texto="Os projetos não carregaram." tentando={projetos.tentando} onTentarDeNovo={projetos.tentarDeNovo} />}{lista?.map((projeto) => <Link key={projeto.id} to={`/projetos/${encodeURIComponent(projeto.id)}`} title={projeto.nome} aria-current={atual === projeto.id ? "page" : undefined}><Monograma nome={projeto.nome} className="e-tabs-mono" /><span className="e-tabs-nome">{projeto.nome}</span></Link>)}{seta("fim")}</nav>;
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
export function Carregando({ children, compacto = false }: { children: string; compacto?: boolean }) {
  return <div className={`e-loading-state${compacto ? " e-loading-compact" : ""}`} role="status">{compacto ? <span className="e-loading-dot" aria-hidden="true" /> : <GatinhoCarregando />}{children}</div>;
}
export function ErroCarregamento({ titulo, erro, onTentarDeNovo, tentando = false, compacto = false }: { titulo: string; erro?: unknown; onTentarDeNovo: () => void; tentando?: boolean; compacto?: boolean }) {
  const motivo = erro instanceof ErroApi && erro.status >= 500 ? "O servidor encontrou um problema. Tente de novo em instantes." : "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.";
  return <div className={`e-load-error${compacto ? " e-load-error-compact" : ""}`} role="alert"><GatinhoCostas /><h2>{titulo}</h2><p>{tentando ? "Tentando de novo…" : motivo}</p><Button color="secondary" size="sm" iconLeading={RefreshIcon} isLoading={tentando} onClick={onTentarDeNovo}>Tentar de novo</Button></div>;
}
export function AvisoCompacto({ texto, onTentarDeNovo, tentando = false }: { texto: string; onTentarDeNovo: () => void; tentando?: boolean }) {
  return <span className="e-inline-error" role="status"><Icon name="cloud-disabled" /><span className="e-inline-error-text">{tentando ? "Tentando de novo…" : texto}</span><Button color="link-color" size="sm" iconLeading={RefreshIcon} isLoading={tentando} showTextWhileLoading onClick={onTentarDeNovo}>Tentar de novo</Button></span>;
}
export function EstadoVazio({ titulo, descricao, acao, icone = "folder", destino, onAcao }: { titulo: string; descricao?: string; acao: string; icone?: string; destino?: string; onAcao?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <div className="e-empty">{icone === "search" ? <GatinhoOlhando /> : <GatinhoDormindo />}<h2>{titulo}</h2>{descricao && <p>{descricao}</p>}<Button color={destino ? "primary" : "secondary"} size="sm" onClick={() => (destino ? navigate(destino, { state: { fundo: location } }) : onAcao?.())}>{acao}</Button></div>;
}
