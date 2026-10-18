import { useCallback, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { atualizarProjeto, buscarProjeto, ErroApi } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";
import { useConsulta } from "../hooks/useConsulta";

export function EditarProjeto() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const consultar = useCallback((signal: AbortSignal) => buscarProjeto(id, signal), [id]);
  const { dados: projeto, erro, carregando } = useConsulta(consultar);
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
    if (!controller.signal.aborted) navigate(voltarPara);
  }

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to={voltarPara}>Voltar para o projeto</Link>
        <h1>Editar projeto</h1>
      </header>
      {carregando && <p role="status">Carregando projeto...</p>}
      {erro !== undefined && (
        <p role="alert">
          {erro instanceof ErroApi && erro.status === 404
            ? "Projeto não encontrado."
            : "Não foi possível carregar o projeto. Confira se a API está em execução."}
        </p>
      )}
      {projeto && (
        <FormularioProjeto
          key={id}
          valoresIniciais={projeto}
          onSalvar={salvar}
          onCancelar={() => navigate(voltarPara)}
          textoSalvar="Salvar alterações"
        />
      )}
    </main>
  );
}
