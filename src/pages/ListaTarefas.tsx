import { VisaoTarefas } from "../components/VisaoTarefas";
import { ordenarTarefas } from "../derivar";

export function ListaTarefas() {
  return (
    <VisaoTarefas titulo="Tarefas">
      {(tarefas, cartao) => (
        <section className="e-list" aria-label="Lista de tarefas">
          {ordenarTarefas(tarefas).map((tarefa) => cartao(tarefa))}
        </section>
      )}
    </VisaoTarefas>
  );
}
