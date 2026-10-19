import { useEffect, useRef } from "react";
import { useFicha } from "../components/ficha-contexto";
import { criarProjeto } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";

export function NovoProjeto() {
  const { navegar, fechar, setOcupada } = useFicha();
  const controllerRef = useRef<AbortController | null>(null);

  // Ao sair da página, o envio pendente é cancelado e a resposta tardia não redireciona.
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);

  async function salvar(dados: DadosProjeto) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    await criarProjeto(dados, controller.signal);
    if (!controller.signal.aborted) navegar("/projetos", true);
  }

  return (
      <FormularioProjeto
        onSalvar={salvar}
        onCancelar={fechar}
        onEstadoEnvio={setOcupada}
      />
  );
}
