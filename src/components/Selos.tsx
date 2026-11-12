import { Badge } from "@/components/base/badges/badges";
import { Icon, PawIcon } from "../design/icon";
import { prioridadeTexto, statusTexto } from "../design/formatos";
import type { Prioridade, Status } from "../tipos";

const iconesPrioridade: Record<Prioridade, string> = { alta: "angle-double-small-up", media: "minus-small", baixa: "arrow-small-down" };

export function SeloStatus({ status, seta = false }: { status: Status; seta?: boolean }) {
  return <span className={`e-card-status e-card-status-${status}`}>{status === "concluida" && <PawIcon />}{statusTexto[status]}{seta && <Icon name="angle-small-down" />}</span>;
}

export function SeloPrioridade({ prioridade }: { prioridade: Prioridade }) {
  return <Badge type="modern" size="sm" color="gray" className={`e-priority e-priority-${prioridade}`}><Icon name={iconesPrioridade[prioridade]} />{prioridadeTexto[prioridade]}</Badge>;
}
