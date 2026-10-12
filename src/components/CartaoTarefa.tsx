import { Link } from "react-router";
import type { Prioridade, Status, Tarefa } from "../tipos";

const statusTexto: Record<Status, string> = {
  "a-fazer": "A fazer",
  "em-andamento": "Em andamento",
  "em-revisao": "Em revisão",
  concluida: "Concluída",
};

const prioridadeTexto: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

interface CartaoTarefaProps {
  tarefa: Tarefa;
}

export function CartaoTarefa({ tarefa }: CartaoTarefaProps) {
  const prazo = new Date(`${tarefa.prazo}T00:00:00`);
  const prazoTexto = Number.isNaN(prazo.getTime())
    ? tarefa.prazo
    : prazo.toLocaleDateString("pt-BR");

  return (
    <article className="cartao-tarefa">
      <div className="cartao-tarefa__topo">
        <span className={`cartao-tarefa__status cartao-tarefa__status--${tarefa.status}`}>
          {statusTexto[tarefa.status]}
        </span>
        <span className={`cartao-tarefa__prioridade cartao-tarefa__prioridade--${tarefa.prioridade}`}>
          Prioridade {prioridadeTexto[tarefa.prioridade].toLowerCase()}
        </span>
      </div>
      <h2>
        <Link to={`/tarefas/${encodeURIComponent(tarefa.id)}`}>{tarefa.titulo}</Link>
      </h2>
      <dl className="cartao-tarefa__detalhes">
        <div>
          <dt>Responsável</dt>
          <dd>{tarefa.responsavel}</dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd>{prazoTexto}</dd>
        </div>
      </dl>
    </article>
  );
}
