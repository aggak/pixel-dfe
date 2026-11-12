import { Badge } from "@/components/base/badges/badges";
import { GatinhoLavando } from "../components/GatinhoLavando";
import { VisaoTarefas } from "../components/VisaoTarefas";
import { agruparPorStatus } from "../derivar";
import { statusTexto } from "../design/formatos";
import { Icon } from "../design/icon";
import type { Status } from "../tipos";

const iconesStatus: Record<Status, string> = { "a-fazer": "circle", "em-andamento": "play", "em-revisao": "eye", concluida: "check" };

export function QuadroTarefas() {
  return <VisaoTarefas titulo="Quadro" classeConteudo="e-content e-board-content">{(tarefas, cartao) => <section className="e-board" aria-label="Quadro de tarefas por status">{agruparPorStatus(tarefas).map((coluna) => <section key={coluna.status} className="e-column" aria-label={statusTexto[coluna.status]} data-status-column={coluna.status}>
    <h2><span className="e-column-name"><Icon name={iconesStatus[coluna.status]} /><span>{statusTexto[coluna.status]}</span></span><Badge type="modern" color="gray" size="sm">{coluna.tarefas.length}</Badge></h2>
    {coluna.tarefas.map((tarefa) => cartao(tarefa, "quadro"))}
    {coluna.tarefas.length === 0 && <p className="e-column-empty"><GatinhoLavando />Nenhuma tarefa</p>}
  </section>)}</section>}</VisaoTarefas>;
}
