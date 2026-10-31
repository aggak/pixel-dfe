import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { useFicha } from "../components/ficha-contexto";
import { atualizarProjeto, buscarProjeto, ErroApi } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";
import { useConsulta } from "../hooks/useConsulta";

export function EditarProjeto() {
  const { id = "" } = useParams();
  const { navegar, fechar, setOcupada } = useFicha();
  const consultar = useCallback((signal: AbortSignal) => buscarProjeto(id, signal), [id]);
  const { dados: projeto, erro, carregando, tentarDeNovo } = useConsulta(consultar);
  const controllerRef = useRef<AbortController | null>(null);
  const voltarPara = `/projetos/${encodeURIComponent(id)}`;

  // A gravação pertence ao ID atual; uma resposta antiga não pode mudar de tela.
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [id]);

  async function salvar(dados: DadosProjeto) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    await atualizarProjeto(id, dados, controller.signal);
    if (!controller.signal.aborted) navegar(voltarPara, true);
  }

  return (
    <>
      {carregando && <p className="e-ficha-state" role="status">Carregando projeto...</p>}
      {erro !== undefined && (
        <p className="e-ficha-state e-form-error" role="alert">
          {erro instanceof ErroApi && erro.status === 404
            ? "Projeto não encontrado."
            : "Não foi possível carregar o projeto. Confira se a API está em execução."}
        </p>
      )}
      {erro !== undefined && !(erro instanceof ErroApi && erro.status === 404) && (
        <Button color="secondary" size="sm" className="e-ficha-retry" onClick={tentarDeNovo}>
          Tentar de novo
        </Button>
      )}
      {projeto && (
        <FormularioProjeto
          key={id}
          valoresIniciais={projeto}
          onSalvar={salvar}
          onCancelar={fechar}
          onEstadoEnvio={setOcupada}
          textoSalvar="Salvar alterações"
        />
      )}
    </>
  );
}
