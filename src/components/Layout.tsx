import { NavLink, Outlet, Link, useLocation, useNavigate } from "react-router";
import { listarProjetos } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { Button } from "@/components/base/buttons/button";
import { FolderIcon } from "../design/icon";

export function Layout() {
  return <div id="pixel-encaixe" className="e-app">
    <header className="e-top"><Link className="e-logo" to="/">Pixel</Link><nav aria-label="Navegação principal"><NavLink to="/" end>Tarefas</NavLink><NavLink to="/projetos">Projetos</NavLink></nav></header>
    <Outlet />
    <footer className="e-footer" aria-label="Informações da Pixel"><div className="e-footer-row"><p className="e-footer-identity"><strong>Pixel</strong><span>Gerenciador de tarefas acadêmicas</span></p><span className="e-footer-context">Desenvolvimento Frontend · ULBRA · 2026.2</span></div><div className="e-footer-row"><nav className="e-footer-links" aria-label="Referências e créditos"><a href="https://github.com/aggak/pixel-dfe" target="_blank" rel="noreferrer">Repositório</a><a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">Uicons por Flaticon</a><a href="https://www.untitledui.com/react/components" target="_blank" rel="noreferrer">Componentes Untitled UI</a><a href="/design-licenses/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Licenças</a></nav></div></footer>
  </div>;
}
export function AbasProjetos({ atual }: { atual?: string }) {
  const { dados: projetos } = useConsulta(listarProjetos);
  return <nav className="e-tabs" aria-label="Projetos"><Link to="/" aria-current={!atual ? "page" : undefined}>Todas</Link>{projetos?.map((projeto) => <Link key={projeto.id} to={`/projetos/${encodeURIComponent(projeto.id)}`} title={projeto.nome} aria-current={atual === projeto.id ? "page" : undefined}>{projeto.nome}</Link>)}</nav>;
}
export function Carregando({ children }: { children: string }) {
  return <div className="e-loading-state" role="status"><span className="e-loading-dot" />{children}</div>;
}
export function EstadoVazio({ titulo, descricao, destino, acao }: { titulo: string; descricao: string; destino: string; acao: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <div className="e-empty"><div className="e-project-icon"><FolderIcon /></div><h2>{titulo}</h2><p>{descricao}</p><Button color="primary" size="sm" onClick={() => navigate(destino, { state: { fundo: location } })}>{acao}</Button></div>;
}
