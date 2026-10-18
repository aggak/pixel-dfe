import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { buscarProjeto, listarTarefasDoProjeto, ErroApi } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { useConsulta } from "../hooks/useConsulta";

export function DetalheProjeto() {
  const { id = "" } = useParams();
  const consultar = useCallback(async (signal: AbortSignal) => {
    const [projeto, tarefas] = await Promise.all([
      buscarProjeto(id, signal),
      listarTarefasDoProjeto(id, signal),
    ]);
    return { projeto, tarefas };
  }, [id]);
  const { dados, erro, carregando } = useConsulta(consultar);

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to="/projetos">Voltar para projetos</Link>
        <h1>{dados ? dados.projeto.nome : "Detalhes do projeto"}</h1>
      </header>
      {carregando && <p role="status">Carregando projeto...</p>}
      {erro !== undefined && (
        <p role="alert">
          {erro instanceof ErroApi && erro.status === 404
            ? "Projeto não encontrado."
            : "Não foi possível carregar o projeto. Confira se a API está em execução."}
        </p>
      )}
      {dados && (
        <>
          <dl className="detalhes-registro">
            <div><dt>Identificador</dt><dd>{dados.projeto.id}</dd></div>
            <div><dt>Descrição</dt><dd>{dados.projeto.descricao}</dd></div>
            <div><dt>Disciplina</dt><dd>{dados.projeto.disciplina}</dd></div>
            <div><dt>Criado em</dt><dd><time dateTime={dados.projeto.criadoEm}>{dados.projeto.criadoEm.split("-").reverse().join("/")}</time></dd></div>
          </dl>
          <section aria-label="Tarefas do projeto">
            <h2>Tarefas do projeto</h2>
            <Link to={`/tarefas/nova?projetoId=${encodeURIComponent(dados.projeto.id)}`}>Nova tarefa</Link>
            {dados.tarefas.length === 0 ? <p>Nenhuma tarefa neste projeto.</p> : (
              <div className="pagina-tarefas__grade">
                {dados.tarefas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} />)}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
