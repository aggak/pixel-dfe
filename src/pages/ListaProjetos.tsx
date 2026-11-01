import { useLocation, useNavigate, Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { listarProjetos } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { Carregando, ErroCarregamento, EstadoVazio } from "../components/Layout";
import { FolderIcon, PlusIcon } from "../design/icon";

export function ListaProjetos() {
  const { dados: projetos, erro, carregando, tentando, tentarDeNovo } = useConsulta(listarProjetos);
  const location = useLocation();
  const navigate = useNavigate();
  return <main className="e-projects"><header className="e-page-heading"><div><h1 tabIndex={-1}>Projetos</h1><p>Um lugar para cada frente de trabalho.</p></div><Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-project" onClick={() => navigate("/projetos/novo", { state: { fundo: location } })}>Novo projeto</Button></header>
    {carregando && <Carregando>Carregando projetos…</Carregando>}
    {erro !== undefined && <ErroCarregamento titulo="Não foi possível carregar os projetos" onTentarDeNovo={tentarDeNovo} tentando={tentando} />}
    {projetos?.length === 0 && <EstadoVazio titulo="Nenhum projeto por aqui" descricao="Crie um projeto para reunir suas tarefas." destino="/projetos/novo" acao="Criar projeto" />}
    {projetos && projetos.length > 0 && <section className="e-project-grid" aria-label="Lista de projetos">{projetos.map((projeto) => <article className="e-project-card" key={projeto.id} data-project-id={projeto.id}><div className="e-project-icon"><FolderIcon /></div><h2><Link to={`/projetos/${encodeURIComponent(projeto.id)}`}>{projeto.nome}</Link></h2><p>{projeto.descricao}</p><div className="e-project-foot"><span className="e-project-discipline">{projeto.disciplina}</span><div className="e-project-card-actions"><Button color="tertiary" size="sm" className="e-edit-project" aria-label={`Editar projeto ${projeto.nome}`} onClick={() => navigate(`/projetos/${encodeURIComponent(projeto.id)}/editar`, { state: { fundo: location } })}>Editar</Button><Button color="secondary" size="sm" onClick={() => navigate(`/projetos/${encodeURIComponent(projeto.id)}`)}>Abrir projeto</Button></div></div></article>)}</section>}
  </main>;
}
