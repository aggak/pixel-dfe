import type { ReactNode } from "react";
import { AnimarPosicoes } from "../components/AnimarPosicoes";
import { useFiltros } from "../components/filtros-contexto";
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
  const { filtros } = useFiltros();
  const { recortar, abertas } = useConcluidasRecolhidas(todasTarefas);
  const ordenadas = ordenarTarefas(tarefas);
  const { visiveis, botao } = recortar(
    ordenadas.filter((tarefa) => tarefa.status === "concluida"),
  );
  return (
    <AnimarPosicoes
      classe="e-list"
      rotulo="Lista de tarefas"
      seletor=":scope > .e-row[data-task-id]"
      tarefas={todasTarefas}
      filtros={filtros}
      concluidasAbertas={abertas}
    >
      {ordenadas
        .filter((tarefa) => tarefa.status !== "concluida")
        .map((tarefa) => cartao(tarefa))}
      {visiveis.map((tarefa) => cartao(tarefa))}
      {botao}
    </AnimarPosicoes>
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
