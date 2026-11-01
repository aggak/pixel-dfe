import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useFicha } from "../components/ficha-contexto";
import { ErroCarregamento } from "../components/Layout";
import { atualizarTarefa, buscarTarefa, ErroApi } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import { useConsulta } from "../hooks/useConsulta";
import type { NovaTarefa } from "../tipos";

export function EditarTarefa() {
  const { id = "" } = useParams();
  const { navegar, fechar, setOcupada } = useFicha();
  const consultar = useCallback((signal: AbortSignal) => buscarTarefa(id, signal), [id]);
  const { dados: tarefa, erro, carregando, tentando, tentarDeNovo } = useConsulta(consultar);
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
    if (!controller.signal.aborted) navegar(voltarPara, true);
  }

  return (
    <>
      {carregando && <p className="e-ficha-state" role="status">Carregando tarefa...</p>}
      {erro instanceof ErroApi && erro.status === 404 && (
        <p className="e-ficha-state e-form-error" role="alert">Tarefa não encontrada.</p>
      )}
      {erro !== undefined && !(erro instanceof ErroApi && erro.status === 404) && (
        <ErroCarregamento compacto titulo="Não foi possível carregar a tarefa" onTentarDeNovo={tentarDeNovo} tentando={tentando} />
      )}
      {tarefa && (
        <FormularioTarefa
          key={id}
          valoresIniciais={tarefa}
          onSalvar={salvar}
          onCancelar={fechar}
          onEstadoEnvio={setOcupada}
          textoSalvar="Salvar alterações"
        />
      )}
    </>
  );
}
