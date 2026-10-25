import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { useFiltros } from "../contexts/filtros-contexto";
import { SearchIcon } from "../design/icon";
import { prioridadeTexto, statusTexto } from "../design/formatos";
import type { Prioridade, Status } from "../tipos";

const opcoesStatus: { id: Status | "todos"; label: string }[] = [
  { id: "todos", label: "Todos os status" },
  ...Object.entries(statusTexto).map(([id, label]) => ({ id: id as Status, label })),
];
const opcoesPrioridade: { id: Prioridade | "todas"; label: string }[] = [
  { id: "todas", label: "Todas as prioridades" },
  ...Object.entries(prioridadeTexto).map(([id, label]) => ({ id: id as Prioridade, label })),
];

export function ControlesFiltro() {
  const { filtros, alterar } = useFiltros();
  return <>
    <Input className="e-task-search" size="sm" type="search" label="Buscar por título" placeholder="Buscar tarefas" icon={SearchIcon} value={filtros.busca} onChange={(busca) => alterar({ busca })} />
    <div className="e-task-filters">
      <Select className="e-task-filter" label="Status" size="sm" items={opcoesStatus} selectedKey={filtros.status} onSelectionChange={(chave) => alterar({ status: (chave ?? "todos") as Status | "todos" })}>{(item) => <Select.Item id={item.id} textValue={item.label}>{item.label}</Select.Item>}</Select>
      <Select className="e-task-filter" label="Prioridade" size="sm" items={opcoesPrioridade} selectedKey={filtros.prioridade} onSelectionChange={(chave) => alterar({ prioridade: (chave ?? "todas") as Prioridade | "todas" })}>{(item) => <Select.Item id={item.id} textValue={item.label}>{item.label}</Select.Item>}</Select>
    </div>
  </>;
}
