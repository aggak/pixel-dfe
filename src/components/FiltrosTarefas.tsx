import { useRef } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { SearchIcon } from "../design/icon";
import { prioridadeTexto, statusTexto } from "../design/formatos";
import { FILTROS_INICIAIS, type Filtros } from "../derivar";
import { useFiltros } from "./filtros-contexto";

const opcoesStatus: { id: Filtros["status"]; label: string }[] = [
  { id: "todos", label: "Todos" },
  ...Object.entries(statusTexto).map(([id, label]) => ({
    id: id as Filtros["status"],
    label,
  })),
];
const opcoesPrioridade: { id: Filtros["prioridade"]; label: string }[] = [
  { id: "todas", label: "Todas" },
  ...Object.entries(prioridadeTexto).map(([id, label]) => ({
    id: id as Filtros["prioridade"],
    label,
  })),
];

export function FiltrosTarefas() {
  const { filtros, alterar, limpar } = useFiltros();
  const busca = useRef<HTMLInputElement>(null);
  const filtrosAtivos =
    filtros.busca !== FILTROS_INICIAIS.busca ||
    filtros.status !== FILTROS_INICIAIS.status ||
    filtros.prioridade !== FILTROS_INICIAIS.prioridade;
  return (
    <>
      <Input
        ref={busca}
        className="e-task-search"
        size="sm"
        type="search"
        label="Buscar por título"
        placeholder="Buscar tarefas"
        icon={SearchIcon}
        value={filtros.busca}
        onChange={(busca) => alterar({ busca })}
      />
      <div className="e-task-filters">
        <Select
          className="e-task-filter"
          label="Status"
          size="sm"
          items={opcoesStatus}
          selectedKey={filtros.status}
          onSelectionChange={(chave) =>
            alterar({ status: (chave ?? "todos") as Filtros["status"] })
          }
        >
          {(item) => (
            <Select.Item id={item.id} textValue={item.label}>
              {item.label}
            </Select.Item>
          )}
        </Select>
        <Select
          className="e-task-filter"
          label="Prioridade"
          size="sm"
          items={opcoesPrioridade}
          selectedKey={filtros.prioridade}
          onSelectionChange={(chave) =>
            alterar({ prioridade: (chave ?? "todas") as Filtros["prioridade"] })
          }
        >
          {(item) => (
            <Select.Item id={item.id} textValue={item.label}>
              {item.label}
            </Select.Item>
          )}
        </Select>
        {filtrosAtivos && (
          <Button
            className="e-task-clear"
            color="tertiary"
            size="sm"
            aria-label="Limpar busca, status e prioridade"
            onClick={() => {
              limpar();
              busca.current?.focus();
            }}
          >
            Limpar
          </Button>
        )}
      </div>
    </>
  );
}
