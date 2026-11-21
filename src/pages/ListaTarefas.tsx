import type { ReactNode } from "react";
import { VisaoTarefas } from "../components/VisaoTarefas";
import { ordenarTarefas } from "../derivar";
import { useConcluidasRecolhidas } from "../hooks/useConcluidasRecolhidas";
import type { Tarefa } from "../tipos";

function Lista({
  tarefas,
  cartao,
  todasTarefas,
}: {
  tarefas: Tarefa[];
  cartao: (tarefa: Tarefa) => ReactNode;
  todasTarefas: Tarefa[];
}) {
  const { recortar } = useConcluidasRecolhidas(todasTarefas);
  const ordenadas = ordenarTarefas(tarefas);
  const { visiveis, botao } = recortar(
    ordenadas.filter((tarefa) => tarefa.status === "concluida"),
  );
  return (
    <section className="e-list" aria-label="Lista de tarefas">
      {ordenadas
        .filter((tarefa) => tarefa.status !== "concluida")
        .map((tarefa) => cartao(tarefa))}
      {visiveis.map((tarefa) => cartao(tarefa))}
      {botao}
    </section>
  );
}

export function ListaTarefas() {
  return (
    <VisaoTarefas titulo="Tarefas">
      {(tarefas, cartao, todasTarefas) => (
        <Lista tarefas={tarefas} cartao={cartao} todasTarefas={todasTarefas} />
      )}
    </VisaoTarefas>
  );
}
