import { Link } from "react-router";
import { listarProjetos } from "../api";
import { useConsulta } from "../hooks/useConsulta";

export function ListaProjetos() {
  const { dados: projetos, erro, carregando } = useConsulta(listarProjetos);

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <p className="pagina-tarefas__legenda">Equipe Pixel · Desenvolvimento Frontend</p>
        <h1>Projetos</h1>
        <p>Conheça os projetos e acompanhe suas tarefas.</p>
      </header>
      {carregando && <p role="status">Carregando projetos...</p>}
      {erro !== undefined && <p role="alert">Não foi possível carregar os projetos. Confira se a API está em execução.</p>}
      {projetos?.length === 0 && <p>Nenhum projeto cadastrado.</p>}
      {projetos && projetos.length > 0 && (
        <section aria-label="Lista de projetos" className="pagina-tarefas__grade">
          {projetos.map((projeto) => (
            <article key={projeto.id} className="cartao-tarefa">
              <h2><Link to={`/projetos/${encodeURIComponent(projeto.id)}`}>{projeto.nome}</Link></h2>
              <p>{projeto.descricao}</p>
              <p><strong>Disciplina:</strong> {projeto.disciplina}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
