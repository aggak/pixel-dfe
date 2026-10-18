import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { criarTarefa } from "../api";
import { FormularioTarefa } from "../components/FormularioTarefa";
import type { NovaTarefa as DadosNovaTarefa } from "../tipos";

export function NovaTarefa() {
  const navigate = useNavigate();
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

  const voltarPara = projetoId ? `/projetos/${encodeURIComponent(projetoId)}` : "/";

  async function salvar(dados: DadosNovaTarefa) {
    const controller = controllerRef.current;
    await criarTarefa(dados, controller?.signal);
    if (!controller?.signal.aborted) navigate("/");
  }

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to={voltarPara}>{projetoId ? "Voltar para o projeto" : "Voltar para tarefas"}</Link>
        <h1>Nova tarefa</h1>
      </header>
      <FormularioTarefa
        key={projetoId}
        valoresIniciais={{ projetoId }}
        onSalvar={salvar}
        onCancelar={() => navigate(voltarPara)}
      />
    </main>
  );
}
