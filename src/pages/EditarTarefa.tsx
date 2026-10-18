import { useCallback, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { atualizarTarefa, buscarTarefa, ErroApi } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import { useConsulta } from "../hooks/useConsulta";
import type { NovaTarefa } from "../tipos";

export function EditarTarefa() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const consultar = useCallback((signal: AbortSignal) => buscarTarefa(id, signal), [id]);
  const { dados: tarefa, erro, carregando } = useConsulta(consultar);
  const controllerRef = useRef<AbortController | null>(null);
  const voltarPara = `/tarefas/${encodeURIComponent(id)}`;

  // A gravação pertence ao ID atual; uma resposta antiga não pode mudar de tela.
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [id]);

  async function salvar(dados: NovaTarefa) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    await atualizarTarefa(id, dados, controller.signal);
    if (!controller.signal.aborted) navigate(voltarPara);
  }

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to={voltarPara}>Voltar para a tarefa</Link>
        <h1>Editar tarefa</h1>
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
        <FormularioTarefa
          key={id}
          valoresIniciais={tarefa}
          onSalvar={salvar}
          onCancelar={() => navigate(voltarPara)}
          textoSalvar="Salvar alterações"
        />
      )}
    </main>
  );
}
