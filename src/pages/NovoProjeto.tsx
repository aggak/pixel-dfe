import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { criarProjeto } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";

export function NovoProjeto() {
  const navigate = useNavigate();
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
    if (!controller.signal.aborted) navigate("/projetos");
  }

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to="/projetos">Voltar para projetos</Link>
        <h1>Novo projeto</h1>
      </header>
      <FormularioProjeto
        onSalvar={salvar}
        onCancelar={() => navigate("/projetos")}
      />
    </main>
  );
}
