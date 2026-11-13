import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useFicha } from "../components/ficha-contexto";
import { criarTarefa } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import type { NovaTarefa as DadosNovaTarefa } from "../tipos";
import { useTituloPagina } from "../hooks/useTituloPagina";

export function NovaTarefa() {
  useTituloPagina("Nova tarefa");
  const { navegar, fechar, destinoFechar, setOcupada } = useFicha();
  const [busca] = useSearchParams();
  const projetoId = busca.get("projetoId") ?? "";
  const controllerRef = useRef<AbortController | null>(null);

  // Um controller por contexto: ao sair da página ou trocar o projeto de origem,
  // o envio pendente é cancelado e a resposta tardia não redireciona.
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [projetoId]);


  async function salvar(dados: DadosNovaTarefa) {
    const controller = controllerRef.current;
    const criada = await criarTarefa(dados, controller?.signal);
    if (!controller?.signal.aborted) navegar(destinoFechar, true, { tarefaCriada: criada.id }, [`[data-task-id="${CSS.escape(criada.id)}"] .e-task-title`, ".e-hidden-notice button", '[data-action="new-task"]']);
  }

  return (
      <FormularioTarefa
        key={projetoId}
        valoresIniciais={{ projetoId }}
        onSalvar={salvar}
        onCancelar={fechar}
        onEstadoEnvio={setOcupada}
      />
  );
}
