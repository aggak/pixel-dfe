import { Link, useLocation, useNavigate } from "react-router";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import type { Tarefa } from "../tipos";
import { Icon, EditIcon, FolderIcon } from "../design/icon";
import { formatarData, prioridadeTexto, statusTexto } from "../design/formatos";

// "lista" mostra a tarefa como linha; "quadro" como cartão empilhado na coluna do status.
export function CartaoTarefa({ tarefa, nomeProjeto, variante = "lista" }: { tarefa: Tarefa; nomeProjeto?: string; variante?: "lista" | "quadro" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const caminho = `/tarefas/${encodeURIComponent(tarefa.id)}`;
  const estado = { fundo: location };
  const emQuadro = variante === "quadro";
  const concluida = tarefa.status === "concluida";
  const classe = emQuadro ? `e-task e-card${!concluida && tarefa.prioridade === "alta" ? " e-card-high" : ""}${concluida ? " e-card-done" : ""}` : "e-task e-row";
  const tagStatus = <BadgeWithDot key="status" type="pill-color" size="sm" color={concluida ? "success" : tarefa.status === "a-fazer" ? "gray" : "brand"} className={`e-status e-status-${tarefa.status}`}>{statusTexto[tarefa.status]}</BadgeWithDot>;
  const tagPrioridade = <Badge key="prioridade" type="modern" size="sm" color="gray" className={`e-priority e-priority-${tarefa.prioridade}`}><Icon name={tarefa.prioridade === "alta" ? "angle-double-small-up" : tarefa.prioridade === "baixa" ? "arrow-small-down" : "minus-small"} />{prioridadeTexto[tarefa.prioridade]}</Badge>;
  return <article className={classe} data-task-id={tarefa.id}>
    <div className="e-task-main"><div className="e-task-heading"><Link className="e-task-title" to={caminho} state={estado}>{tarefa.titulo}</Link>
      <Dropdown.Root><Button color="tertiary" size="sm" className="e-task-menu" aria-label={`Ações de ${tarefa.titulo}`}><Icon name="menu-dots-vertical" /></Button><Dropdown.Popover className="e-popover"><Dropdown.Menu aria-label={`Ações de ${tarefa.titulo}`}><Dropdown.Item id="editar" label="Editar tarefa" icon={EditIcon} onAction={() => navigate(`${caminho}/editar`, { state: estado })} /></Dropdown.Menu></Dropdown.Popover></Dropdown.Root>
    </div>{nomeProjeto && <span className="e-task-project"><FolderIcon />{nomeProjeto}</span>}<div className="e-task-meta"><span><Icon name="user" />{tarefa.responsavel}</span><span><Icon name="calendar" /><time dateTime={tarefa.prazo}>{formatarData(tarefa.prazo)}</time></span></div></div>
    <div className="e-task-tags">{emQuadro ? [tagPrioridade, tagStatus] : [tagStatus, tagPrioridade]}</div>
  </article>;
}
