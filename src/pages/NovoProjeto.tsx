import { useEffect, useRef, useState } from "react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useFicha } from "../components/ficha-contexto";
import { criarProjeto } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";
import { useTituloPagina } from "../hooks/useTituloPagina";

export function NovoProjeto() {
  useTituloPagina("Novo projeto");
  const { navegar, fechar, setOcupada, setAlterada } = useFicha();
  const controllerRef = useRef<AbortController | null>(null);
  const [hoje] = useState(() => today(getLocalTimeZone()).toString());

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);

  async function salvar(dados: DadosProjeto) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    const criado = await criarProjeto(dados, controller.signal);
    if (!controller.signal.aborted)
      navegar("/projetos", true, undefined, [
        `[data-project-id="${CSS.escape(criado.id)}"] h2 a`,
        '[data-action="new-project"]',
      ]);
  }

  return (
    <FormularioProjeto
      valoresIniciais={{ criadoEm: hoje }}
      onSalvar={salvar}
      onCancelar={fechar}
      onEstadoEnvio={setOcupada}
      onAlteracao={setAlterada}
    />
  );
}
