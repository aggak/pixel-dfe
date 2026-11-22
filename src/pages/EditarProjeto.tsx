import { useCallback, useEffect, useRef } from "react";
import { useLocation, useParams } from "react-router";
import { useFicha } from "../components/ficha-contexto";
import { ErroCarregamento } from "../components/Layout";
import { atualizarProjeto, buscarProjeto, ErroApi } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { GatinhoCochilando } from "../components/GatinhoCochilando";
import { GatinhoAbanando } from "../components/GatinhoAbanando";

export function EditarProjeto() {
  const { id = "" } = useParams();
  const { navegar, fechar, setOcupada, setAlterada } = useFicha();
  const detalhes =
    (useLocation().state as { detalhes?: boolean } | null)?.detalhes === true;
  const consultar = useCallback(
    (signal: AbortSignal) => buscarProjeto(id, signal),
    [id],
  );
  const {
    dados: projeto,
    erro,
    carregando,
    tentando,
    tentarDeNovo,
  } = useConsulta(consultar);
  useTituloPagina(
    erro instanceof ErroApi && erro.status === 404
      ? "Projeto não encontrado"
      : projeto
        ? `Editar: ${projeto.nome}`
        : "Editar projeto",
  );
  const controllerRef = useRef<AbortController | null>(null);
  const voltarPara = `/projetos/${encodeURIComponent(id)}`;

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [id]);

  async function salvar(dados: DadosProjeto) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || !projeto) return;
    const alteracoes: Partial<DadosProjeto> = { ...dados };
    for (const campo of Object.keys(dados) as (keyof DadosProjeto)[]) {
      if (dados[campo] === projeto[campo]) delete alteracoes[campo];
    }
    await atualizarProjeto(id, alteracoes, controller.signal);
    if (!controller.signal.aborted)
      navegar(
        voltarPara,
        true,
        detalhes ? { detalhes } : undefined,
        detalhes ? [".e-edit-project-details", "main h1"] : ["main h1"],
      );
  }

  return (
    <>
      {carregando && (
        <>
          <div className="e-ficha-gato">
            <GatinhoAbanando />
          </div>
          <p className="e-ficha-state e-ficha-loading-projeto" role="status">
            Carregando projeto…
          </p>
        </>
      )}
      {erro instanceof ErroApi && erro.status === 404 && (
        <>
          <div className="e-ficha-gato">
            <GatinhoCochilando />
          </div>
          <p className="e-ficha-state e-form-error" role="alert">
            Este projeto não existe ou foi removido.
          </p>
        </>
      )}
      {erro !== undefined &&
        !(erro instanceof ErroApi && erro.status === 404) && (
          <ErroCarregamento
            compacto
            titulo="Não foi possível carregar o projeto"
            erro={erro}
            onTentarDeNovo={tentarDeNovo}
            tentando={tentando}
          />
        )}
      {projeto && (
        <FormularioProjeto
          key={id}
          valoresIniciais={projeto}
          edicao
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
