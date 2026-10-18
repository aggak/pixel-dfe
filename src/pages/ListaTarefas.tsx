import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listarTarefas } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import type { Tarefa } from "../tipos";

export function ListaTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    listarTarefas(controller.signal)
      .then((dados) => setTarefas(dados))
      .catch(() => {
        if (!controller.signal.aborted) setErro(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <p className="pagina-tarefas__legenda">Equipe Pixel · Desenvolvimento Frontend</p>
        <h1>Tarefas</h1>
        <p>Acompanhe as atividades dos projetos da equipe.</p>
        <Link to="/tarefas/nova">Nova tarefa</Link>
      </header>

      {carregando && <p role="status">Carregando tarefas...</p>}
      {erro && <p role="alert">Não foi possível carregar as tarefas. Confira se a API está em execução.</p>}
      {!carregando && !erro && tarefas.length === 0 && (
        <p>Nenhuma tarefa cadastrada.</p>
      )}
      {!carregando && !erro && tarefas.length > 0 && (
        <section aria-label="Lista de tarefas" className="pagina-tarefas__grade">
          {tarefas.map((tarefa) => (
            <CartaoTarefa key={tarefa.id} tarefa={tarefa} />
          ))}
        </section>
      )}
    </main>
  );
}
