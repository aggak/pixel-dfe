import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import {
  buscarProjetoComTarefas,
  excluirTarefaSeExistir,
  listarProjetos,
  ErroApi,
} from "../api";
import { ordenarTarefas } from "../derivar";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { AcaoCabecalho } from "../components/Cabecalho";
import { GatinhoCochilando } from "../components/GatinhoCochilando";
import {
  AbasProjetos,
  AvisoTarefaEscondida,
  ErroCarregamento,
  EstadoVazio,
} from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { useMudarStatus } from "../hooks/useMudarStatus";
import { useRetornoFoco } from "../hooks/useRetornoFoco";
import { PlusIcon } from "../design/icon";
import { ResumoProjeto } from "../components/ResumoProjeto";
import type { Tarefa } from "../tipos";

export function DetalheProjeto() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const consultar = useCallback(
    (signal: AbortSignal) => buscarProjetoComTarefas(id, signal),
    [id],
  );
  const { dados, erro, carregando, tentando, tentarDeNovo, revalidando } =
    useConsulta(consultar);
  const naoEncontrado = erro instanceof ErroApi && erro.status === 404;
  const tituloErro = naoEncontrado
    ? "Projeto não encontrado"
    : "Não foi possível carregar o projeto";
  useTituloPagina(
    naoEncontrado ? tituloErro : (dados?.projeto.nome ?? "Projeto"),
  );
  const consultaProjetos = useConsulta(listarProjetos);
  const tentarTudo = () => {
    tentarDeNovo();
    if (consultaProjetos.erro !== undefined) consultaProjetos.tentarDeNovo();
  };
  const [tarefas, setTarefas] = useState<Tarefa[]>(dados?.tarefas ?? []);
  const [origem, setOrigem] = useState(dados);
  if (dados !== origem) {
    setOrigem(dados);
    setTarefas(dados?.tarefas ?? []);
  }
  const { mudarStatus, aviso, inexistente, alertaInexistente } = useMudarStatus(
    tarefas,
    setTarefas,
  );
  useRetornoFoco(dados !== undefined && !revalidando);
  const excluir = async (tarefa: Tarefa) => {
    await excluirTarefaSeExistir(tarefa.id);
    setTarefas((atuais) => atuais.filter((atual) => atual.id !== tarefa.id));
  };
  const novaTarefa = `/tarefas/nova?projetoId=${encodeURIComponent(id)}`;
  return (
    <>
      <AbasProjetos
        atual={id}
        projetos={consultaProjetos}
        mostrarErro={erro === undefined}
      />
      <main className="e-sheet">
        <AcaoCabecalho>
          {(dados || carregando) && (
            <Button
              className="e-top-acao-botao"
              style={carregando ? { visibility: "hidden" } : undefined}
              color="primary"
              size="sm"
              iconLeading={PlusIcon}
              aria-label="Nova tarefa"
              data-action="new-task"
              onClick={() =>
                navigate(novaTarefa, { state: { fundo: location } })
              }
            >
              Nova tarefa
            </Button>
          )}
        </AcaoCabecalho>
        {dados || carregando ? (
          <ResumoProjeto
            key={id}
            concluido={
              tarefas.length > 0 &&
              tarefas.every((tarefa) => tarefa.status === "concluida")
            }
            projeto={dados?.projeto}
          />
        ) : (
          <h1 className="e-task-page-title" tabIndex={-1}>
            {tituloErro}
          </h1>
        )}
        {aviso && (
          <p className="sr-only" role="status">
            {aviso}
          </p>
        )}
        <div className="e-content">
          {inexistente && (
            <p
              ref={alertaInexistente}
              className="e-task-error"
              role="alert"
              tabIndex={-1}
            >
              {inexistente}
            </p>
          )}
          {dados && (
            <AvisoTarefaEscondida
              tarefas={tarefas}
              exibidas={tarefas}
              projetoAtual={id}
            />
          )}
          {naoEncontrado ? (
            <div className="e-load-error" role="alert">
              <GatinhoCochilando />
              <h2>{tituloErro}</h2>
              <p>Este projeto não existe ou foi removido.</p>
              <Link to="/projetos">Voltar para projetos</Link>
            </div>
          ) : (
            erro !== undefined && (
              <ErroCarregamento
                titulo={tituloErro}
                erro={erro}
                onTentarDeNovo={tentarTudo}
                tentando={tentando}
              />
            )
          )}
          {dados && (
            <section aria-label="Tarefas do projeto">
              {tarefas.length === 0 ? (
                <EstadoVazio
                  gato="dormindo"
                  titulo="Este projeto ainda não tem tarefas"
                  destino={novaTarefa}
                  acao="Criar tarefa"
                />
              ) : (
                <div className="e-list">
                  {ordenarTarefas(tarefas).map((tarefa) => (
                    <CartaoTarefa
                      key={tarefa.id}
                      tarefa={tarefa}
                      onMudarStatus={mudarStatus}
                      onExcluir={excluir}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        {tarefas.length > 0 && (
          <footer className="e-sheet-footer">
            {tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}
          </footer>
        )}
      </main>
    </>
  );
}
