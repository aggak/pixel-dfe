import { useLocation, useNavigate, Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { listarProjetos, listarTarefas } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { useRetornoFoco } from "../hooks/useRetornoFoco";
import { AvisoCompacto, Carregando, ErroCarregamento, EstadoVazio } from "../components/Layout";
import { AndamentoProjeto, Monograma } from "../components/CartaoProjeto";
import { EditIcon, PlusIcon } from "../design/icon";
import { AcaoCabecalho } from "../components/Cabecalho";

export function ListaProjetos() {
  useTituloPagina("Projetos");
  const { dados: projetos, erro, carregando, tentando, tentarDeNovo } = useConsulta(listarProjetos);
  const { dados: tarefas, erro: erroTarefas, carregando: carregandoTarefas, tentando: tentandoTarefas, tentarDeNovo: tentarTarefas } = useConsulta(listarTarefas);
  const location = useLocation();
  const navigate = useNavigate();
  useRetornoFoco(projetos !== undefined && !carregandoTarefas);
  return <main className="e-projects"><header className="e-page-heading"><div><h1 tabIndex={-1}>Projetos</h1><p>Um lugar para cada frente de trabalho.</p></div><AcaoCabecalho><Button className="e-top-acao-botao" color="primary" size="sm" iconLeading={PlusIcon} aria-label="Novo projeto" data-action="new-project" onClick={() => navigate("/projetos/novo", { state: { fundo: location } })}>Novo projeto</Button></AcaoCabecalho></header>
    {carregando && <Carregando>Carregando projetos…</Carregando>}
    {erro !== undefined && <ErroCarregamento titulo="Não foi possível carregar os projetos" erro={erro} onTentarDeNovo={tentarDeNovo} tentando={tentando} />}
    {projetos?.length === 0 && <EstadoVazio titulo="Nenhum projeto por aqui" descricao="Crie um projeto para reunir suas tarefas." destino="/projetos/novo" acao="Criar projeto" />}
    {projetos && projetos.length > 0 && erroTarefas !== undefined && <div className="e-projects-aviso"><AvisoCompacto texto="O andamento dos projetos não carregou." tentando={tentandoTarefas} onTentarDeNovo={tentarTarefas} /></div>}
    {projetos && projetos.length > 0 && <section className="e-project-grid" aria-label="Lista de projetos">{projetos.map((projeto) => <article className="e-project-card" key={projeto.id} data-project-id={projeto.id}><div className="e-proj-cab"><Monograma nome={projeto.nome} /><div className="e-proj-cab-txt"><span className="e-project-discipline">{projeto.disciplina}</span><h2><Link to={`/projetos/${encodeURIComponent(projeto.id)}`}>{projeto.nome}</Link></h2></div><Button color="tertiary" size="sm" className="e-edit-project" iconLeading={EditIcon} aria-label={`Editar projeto ${projeto.nome}`} onClick={() => navigate(`/projetos/${encodeURIComponent(projeto.id)}/editar`, { state: { fundo: location } })} /></div><p>{projeto.descricao}</p><AndamentoProjeto tarefas={tarefas?.filter((tarefa) => tarefa.projetoId === projeto.id)} /></article>)}</section>}
  </main>;
}
