import { useEffect, useRef } from "react";
import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router";
import { listarProjetos } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { Button } from "@/components/base/buttons/button";
import { BoardIcon, FolderIcon, Icon, ListIcon } from "../design/icon";

// Caminho como o roteador casa as rotas: sem barra final e sem diferença de maiúsculas.
function caminhoNormalizado(pathname: string) {
  return pathname.replace(/\/+$/, "").toLowerCase() || "/";
}
export function Layout() {
  const caminho = caminhoNormalizado(useLocation().pathname);
  // Lista e quadro são duas visões da mesma seção: "Tarefas" fica marcado nas duas.
  const emTarefas = caminho === "/" || caminho === "/quadro";
  return <div id="pixel-encaixe" className="e-app">
    <header className="e-top"><Link className="e-logo" to="/">Pixel</Link><nav aria-label="Navegação principal"><Link to="/" aria-current={emTarefas ? "page" : undefined}>Tarefas</Link><NavLink to="/projetos">Projetos</NavLink></nav></header>
    <Outlet />
    <footer className="e-footer" aria-label="Informações da Pixel"><div className="e-footer-row"><p className="e-footer-identity"><strong>Pixel</strong><span>Gerenciador de tarefas acadêmicas</span></p><span className="e-footer-context">Desenvolvimento Frontend · ULBRA · 2026.2</span></div><div className="e-footer-row"><nav className="e-footer-links" aria-label="Referências e créditos"><a href="https://github.com/aggak/pixel-dfe" target="_blank" rel="noreferrer">Repositório</a><a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Uicons por Flaticon</a><a href="https://www.untitledui.com/react/components" target="_blank" rel="noreferrer">Componentes Untitled UI</a><a href={`${import.meta.env.BASE_URL}design-licenses/THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Licenças</a></nav></div></footer>
  </div>;
}
export function AbasProjetos({ atual }: { atual?: string }) {
  const { dados: projetos, carregando } = useConsulta(listarProjetos);
  return <nav className="e-tabs" aria-label="Projetos"><Link to="/" aria-current={!atual ? "page" : undefined}>Todas</Link>{carregando && <Carregando compacto>Carregando projetos…</Carregando>}{projetos?.map((projeto) => <Link key={projeto.id} to={`/projetos/${encodeURIComponent(projeto.id)}`} title={projeto.nome} aria-current={atual === projeto.id ? "page" : undefined}>{projeto.nome}</Link>)}</nav>;
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
  return <div className={`e-loading-state${compacto ? " e-loading-compact" : ""}`} role="status"><span className="e-loading-dot" aria-hidden="true" />{children}</div>;
}
export function ErroCarregamento({ titulo, onTentarDeNovo }: { titulo: string; onTentarDeNovo: () => void }) {
  return <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>{titulo}</h2><p>Confira se a API está em execução.</p><Button color="secondary" size="sm" onClick={onTentarDeNovo}>Tentar de novo</Button></div>;
}
export function EstadoVazio({ titulo, descricao, destino, acao }: { titulo: string; descricao: string; destino: string; acao: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <div className="e-empty"><div className="e-project-icon"><FolderIcon /></div><h2>{titulo}</h2><p>{descricao}</p><Button color="primary" size="sm" onClick={() => navigate(destino, { state: { fundo: location } })}>{acao}</Button></div>;
}
