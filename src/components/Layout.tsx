import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router";
import { useConsulta } from "../hooks/useConsulta";
import { useTrocaDeAba } from "../hooks/useTrocaDeAba";
import { useRolagemAbas } from "../hooks/useRolagemAbas";
import { Button } from "@/components/base/buttons/button";
import { BoardIcon, Icon, ListIcon, RefreshIcon } from "../design/icon";
import type { Projeto } from "../tipos";
import { Gatinho } from "./Gatinho";
import { GatinhoOlhando } from "./GatinhoOlhando";
import { GatinhoDormindo } from "./GatinhoDormindo";
import { GatinhoCostas } from "./GatinhoCostas";
import { GatinhoCarregando } from "./GatinhoCarregando";

// Caminho como o roteador casa as rotas: sem barra final e sem diferença de maiúsculas.
function caminhoNormalizado(pathname: string) {
  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}
export function Layout() {
  const caminho = caminhoNormalizado(useLocation().pathname);
  // Lista e quadro são duas visões da mesma seção: "Tarefas" fica marcado nas duas.
  const emTarefas = caminho === "/" || caminho === "/quadro";
  return <div id="pixel-encaixe" className="e-app">
    <header className="e-top"><Link className="e-logo" to="/"><Gatinho escala={2} />Pixel</Link><nav aria-label="Navegação principal"><Link to="/" aria-current={emTarefas ? "page" : undefined}>Tarefas</Link><NavLink to="/projetos">Projetos</NavLink></nav></header>
    <Outlet />
    <footer className="e-footer" aria-label="Informações da Pixel"><div className="e-footer-row"><p className="e-footer-identity"><Gatinho escala={1} /><strong>Pixel</strong><span>Gerenciador de tarefas acadêmicas</span></p><span className="e-footer-context">Desenvolvimento Frontend · ULBRA · 2026.2</span></div><div className="e-footer-row"><nav className="e-footer-links" aria-label="Referências e créditos"><a href="https://github.com/aggak/pixel-dfe" target="_blank" rel="noreferrer">Repositório</a><a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Uicons por Flaticon</a><a href="https://www.untitledui.com/react/components" target="_blank" rel="noreferrer">Componentes Untitled UI</a><a href={`${import.meta.env.BASE_URL}design-licenses/THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Licenças</a></nav></div></footer>
  </div>;
}
export function AbasProjetos({ atual, projetos, mostrarErro = true }: { atual?: string; projetos: ReturnType<typeof useConsulta<Projeto[]>>; mostrarErro?: boolean }) {
  const { puxada, encerrar } = useTrocaDeAba(atual ?? "todas");
  const barra = useRef<HTMLElement>(null);
  const { temEsquerda, temDireita, rolar } = useRolagemAbas(barra, projetos.dados);
  // A aba ativa precisa estar inteira à vista: é nela que a patinha aparece.
  useLayoutEffect(() => {
    const alinhar = () => barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    alinhar();
    // Quando a fonte da página termina de carregar as abas mudam de largura; refaz o alinhamento se ninguém rolou a barra no meio tempo.
    const posicao = barra.current?.scrollLeft;
    let ativo = true;
    document.fonts?.ready.then(() => { if (ativo && barra.current?.scrollLeft === posicao) alinhar(); });
    return () => { ativo = false; };
  }, [atual, projetos.dados]);
  // A patinha mora dentro da aba ativa: o recorte da aba faz parte do efeito.
  const marca = (ativa: boolean) => ativa && puxada > 0 ? { "data-puxada": "" } : {};
  return <div className="e-tabs-barra">{temEsquerda && <button type="button" className="e-tabs-seta e-tabs-seta-esq" tabIndex={-1} aria-label="Mostrar projetos à esquerda" onClick={() => rolar(-1)}><Icon name="angle-small-left" /></button>}<nav ref={barra} className="e-tabs" aria-label="Projetos"><Link to="/" aria-current={!atual ? "page" : undefined} {...marca(!atual)}>Todas{!atual && puxada > 0 && <PataPuxando chave={puxada} onFim={encerrar} />}</Link>{projetos.carregando && <Carregando compacto>Carregando projetos…</Carregando>}{mostrarErro && projetos.erro !== undefined && <AvisoCompacto texto="Os projetos não carregaram." tentando={projetos.tentando} onTentarDeNovo={projetos.tentarDeNovo} />}{projetos.dados?.map((projeto) => <Link key={projeto.id} to={`/projetos/${encodeURIComponent(projeto.id)}`} title={projeto.nome} aria-current={atual === projeto.id ? "page" : undefined} {...marca(atual === projeto.id)}>{projeto.nome}{atual === projeto.id && puxada > 0 && <PataPuxando chave={puxada} onFim={encerrar} />}</Link>)}</nav>{temDireita && <button type="button" className="e-tabs-seta e-tabs-seta-dir" tabIndex={-1} aria-label="Mostrar projetos à direita" onClick={() => rolar(1)}><Icon name="angle-small-right" /></button>}</div>;
}
function PataPuxando({ chave, onFim }: { chave: number; onFim: () => void }) {
  return <span key={chave} className="e-pata" aria-hidden="true" onAnimationEnd={(e) => e.animationName === "e-pata-puxar" && onFim()}><Gatinho pose="pata" escala={2} /></span>;
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
export function ErroCarregamento({ titulo, onTentarDeNovo, tentando = false, compacto = false }: { titulo: string; onTentarDeNovo: () => void; tentando?: boolean; compacto?: boolean }) {
  return <div className={`e-load-error${compacto ? " e-load-error-compact" : ""}`} role="alert"><GatinhoCostas /><h2>{titulo}</h2><p>{tentando ? "Tentando de novo…" : "O servidor não respondeu. Confira se a API está em execução."}</p><Button color="secondary" size="sm" iconLeading={RefreshIcon} isLoading={tentando} onClick={onTentarDeNovo}>Tentar de novo</Button></div>;
}
export function AvisoCompacto({ texto, onTentarDeNovo, tentando = false }: { texto: string; onTentarDeNovo: () => void; tentando?: boolean }) {
  return <span className="e-inline-error" role="status"><Icon name="cloud-disabled" /><span className="e-inline-error-text">{tentando ? "Tentando de novo…" : texto}</span><Button color="link-color" size="sm" iconLeading={RefreshIcon} isLoading={tentando} showTextWhileLoading onClick={onTentarDeNovo}>Tentar de novo</Button></span>;
}
export function EstadoVazio({ titulo, descricao, acao, icone = "folder", destino, onAcao }: { titulo: string; descricao?: string; acao: string; icone?: string; destino?: string; onAcao?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <div className="e-empty">{icone === "search" ? <GatinhoOlhando /> : <GatinhoDormindo />}<h2>{titulo}</h2>{descricao && <p>{descricao}</p>}<Button color={destino ? "primary" : "secondary"} size="sm" onClick={() => (destino ? navigate(destino, { state: { fundo: location } }) : onAcao?.())}>{acao}</Button></div>;
}
