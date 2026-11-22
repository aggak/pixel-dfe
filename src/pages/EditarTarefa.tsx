import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useFicha } from "../components/ficha-contexto";
import { ErroCarregamento } from "../components/Layout";
import { atualizarTarefa, buscarTarefa, ErroApi } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import type { NovaTarefa } from "../tipos";
import { GatinhoCochilando } from "../components/GatinhoCochilando";
import { GatinhoAbanando } from "../components/GatinhoAbanando";

export function EditarTarefa() {
  const { id = "" } = useParams();
  const { navegar, fechar, setOcupada, setAlterada } = useFicha();
  const consultar = useCallback(
    (signal: AbortSignal) => buscarTarefa(id, signal),
    [id],
  );
  const {
    dados: tarefa,
    erro,
    carregando,
    tentando,
    tentarDeNovo,
  } = useConsulta(consultar);
  useTituloPagina(
    erro instanceof ErroApi && erro.status === 404
      ? "Tarefa não encontrada"
      : tarefa
        ? `Editar: ${tarefa.titulo}`
        : "Editar tarefa",
  );
  const controllerRef = useRef<AbortController | null>(null);
  const voltarPara = `/tarefas/${encodeURIComponent(id)}`;

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [id]);

  async function salvar(dados: NovaTarefa) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || !tarefa) return;
    const alteracoes: Partial<NovaTarefa> = { ...dados };
    for (const campo of Object.keys(dados) as (keyof NovaTarefa)[]) {
      if (dados[campo] === tarefa[campo]) delete alteracoes[campo];
    }
    await atualizarTarefa(id, alteracoes, controller.signal);
    if (!controller.signal.aborted)
      navegar(voltarPara, true, undefined, [
        `[data-task-id="${CSS.escape(id)}"] .e-task-title`,
      ]);
  }

  return (
    <>
      {carregando && (
        <>
          <div className="e-ficha-gato">
            <GatinhoAbanando />
          </div>
          <p className="e-ficha-state e-ficha-loading-tarefa" role="status">
            Carregando tarefa…
          </p>
        </>
      )}
      {erro instanceof ErroApi && erro.status === 404 && (
        <>
          <div className="e-ficha-gato">
            <GatinhoCochilando />
          </div>
          <p className="e-ficha-state e-form-error" role="alert">
            Tarefa não encontrada. Ela pode ter sido excluída.
          </p>
        </>
      )}
      {erro !== undefined &&
        !(erro instanceof ErroApi && erro.status === 404) && (
          <ErroCarregamento
            compacto
            titulo="Não foi possível carregar a tarefa"
            erro={erro}
            onTentarDeNovo={tentarDeNovo}
            tentando={tentando}
          />
        )}
      {tarefa && (
        <FormularioTarefa
          key={id}
          valoresIniciais={tarefa}
          edicao
          compacto
          onSalvar={salvar}
          onCancelar={fechar}
          onEstadoEnvio={setOcupada}
          onAlteracao={setAlterada}
          textoSalvar="Salvar alterações"
        />
      )}
    </>
  );
}
