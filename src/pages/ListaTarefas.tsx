import { VisaoTarefas } from "../components/VisaoTarefas";

export function ListaTarefas() {
  return <VisaoTarefas titulo="Tarefas">{(tarefas, cartao) => <section className="e-list" aria-label="Lista de tarefas">{tarefas.map((tarefa) => cartao(tarefa))}</section>}</VisaoTarefas>;
}
