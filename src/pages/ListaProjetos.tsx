import { useLocation, useNavigate, Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { listarProjetos, listarTarefas } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { AvisoCompacto, Carregando, ErroCarregamento, EstadoVazio } from "../components/Layout";
import { AndamentoProjeto, Monograma } from "../components/CartaoProjeto";
import { EditIcon, PlusIcon } from "../design/icon";

export function ListaProjetos() {
  const { dados: projetos, erro, carregando, tentando, tentarDeNovo } = useConsulta(listarProjetos);
  const { dados: tarefas, erro: erroTarefas, tentando: tentandoTarefas, tentarDeNovo: tentarTarefas } = useConsulta(listarTarefas);
  const location = useLocation();
  const navigate = useNavigate();
  return <main className="e-projects"><header className="e-page-heading"><div><h1 tabIndex={-1}>Projetos</h1><p>Um lugar para cada frente de trabalho.</p></div><Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-project" onClick={() => navigate("/projetos/novo", { state: { fundo: location } })}>Novo projeto</Button></header>
    {carregando && <Carregando>Carregando projetos…</Carregando>}
    {erro !== undefined && <ErroCarregamento titulo="Não foi possível carregar os projetos" erro={erro} onTentarDeNovo={tentarDeNovo} tentando={tentando} />}
    {projetos?.length === 0 && <EstadoVazio titulo="Nenhum projeto por aqui" descricao="Crie um projeto para reunir suas tarefas." destino="/projetos/novo" acao="Criar projeto" />}
    {projetos && projetos.length > 0 && erroTarefas !== undefined && <div className="e-projects-aviso"><AvisoCompacto texto="O andamento dos projetos não carregou." tentando={tentandoTarefas} onTentarDeNovo={tentarTarefas} /></div>}
    {projetos && projetos.length > 0 && <section className="e-project-grid" aria-label="Lista de projetos">{projetos.map((projeto) => <article className="e-project-card" key={projeto.id} data-project-id={projeto.id}><div className="e-proj-cab"><Monograma nome={projeto.nome} /><div className="e-proj-cab-txt"><span className="e-project-discipline">{projeto.disciplina}</span><h2><Link to={`/projetos/${encodeURIComponent(projeto.id)}`}>{projeto.nome}</Link></h2></div><Button color="tertiary" size="sm" className="e-edit-project" iconLeading={EditIcon} aria-label={`Editar projeto ${projeto.nome}`} onClick={() => navigate(`/projetos/${encodeURIComponent(projeto.id)}/editar`, { state: { fundo: location } })} /></div><p>{projeto.descricao}</p><AndamentoProjeto tarefas={tarefas?.filter((tarefa) => tarefa.projetoId === projeto.id)} /></article>)}</section>}
  </main>;
}
