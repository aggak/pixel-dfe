import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";
import { useFicha, type EstadoFicha } from "../components/ficha-contexto";
import { criarTarefa } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import type { NovaTarefa as DadosNovaTarefa } from "../tipos";

export function NovaTarefa() {
  const { navegar, fechar, setOcupada } = useFicha();
  const [busca] = useSearchParams();
  const projetoId = busca.get("projetoId") ?? "";
  // Criada a partir do quadro, a tarefa volta para o quadro; nos demais casos, para a lista.
  const location = useLocation();
  const voltarPara = (location.state as EstadoFicha | null)?.fundo?.pathname === "/quadro" ? "/quadro" : "/";
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
    await criarTarefa(dados, controller?.signal);
    if (!controller?.signal.aborted) navegar(voltarPara, true);
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
