import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { buscarTarefa, ErroApi } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { useConsulta } from "../hooks/useConsulta";

export function DetalheTarefa() {
  const { id = "" } = useParams();
  const consultar = useCallback((signal: AbortSignal) => buscarTarefa(id, signal), [id]);
  const { dados: tarefa, erro, carregando } = useConsulta(consultar);

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to="/">Voltar para tarefas</Link>
        <h1>Detalhes da tarefa</h1>
      </header>
      {carregando && <p role="status">Carregando tarefa...</p>}
      {erro !== undefined && (
        <p role="alert">
          {erro instanceof ErroApi && erro.status === 404
            ? "Tarefa não encontrada."
            : "Não foi possível carregar a tarefa. Confira se a API está em execução."}
        </p>
      )}
      {tarefa && (
        <section aria-label="Dados da tarefa">
          <CartaoTarefa tarefa={tarefa} />
          <dl className="detalhes-registro">
            <div><dt>Identificador</dt><dd>{tarefa.id}</dd></div>
            <div><dt>Projeto</dt><dd><Link to={`/projetos/${encodeURIComponent(tarefa.projetoId)}`}>Projeto {tarefa.projetoId}</Link></dd></div>
            <div><dt>Descrição</dt><dd>{tarefa.descricao}</dd></div>
          </dl>
        </section>
      )}
    </main>
  );
}
