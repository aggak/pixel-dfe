import { useState } from "react";
import { useFiltros } from "../components/filtros-contexto";
import { Icon } from "../design/icon";
import type { Tarefa } from "../tipos";

const CONCLUIDAS_VISIVEIS = 3;

function useConcluidasRecentes(todasTarefas: Tarefa[]) {
  const ids = todasTarefas
    .filter((tarefa) => tarefa.status === "concluida")
    .map((tarefa) => tarefa.id);
  const chave = ids.join(",");
  const [registro, setRegistro] = useState({
    chave,
    total: todasTarefas.length,
    recentes: [] as string[],
  });
  if (registro.chave !== chave) {
    const antes = new Set(registro.chave.split(","));
    const entraram =
      registro.total === 0 ? [] : ids.filter((id) => !antes.has(id));
    setRegistro({
      chave,
      total: todasTarefas.length,
      recentes: [
        ...entraram,
        ...registro.recentes.filter((id) => ids.includes(id)),
      ],
    });
  }
  return registro.recentes;
}

export function useConcluidasRecolhidas(todasTarefas: Tarefa[]) {
  const { filtros } = useFiltros();
  const [abertas, setAbertas] = useState(false);
  const recentes = useConcluidasRecentes(todasTarefas);
  const recortar = (concluidas: Tarefa[]) => {
    if (
      filtros.status === "concluida" ||
      concluidas.length <= CONCLUIDAS_VISIVEIS
    )
      return { visiveis: concluidas, botao: null };
    const ordenadas = [...concluidas].sort((a, b) => {
      const ra = recentes.indexOf(a.id);
      const rb = recentes.indexOf(b.id);
      if (ra !== rb) return ra < 0 ? 1 : rb < 0 ? -1 : ra - rb;
      if (a.ordem !== undefined || b.ordem !== undefined)
        return (
          (a.ordem ?? Number.MAX_SAFE_INTEGER) -
          (b.ordem ?? Number.MAX_SAFE_INTEGER)
        );
      return b.prazo.localeCompare(a.prazo);
    });
    return {
      visiveis: abertas ? ordenadas : ordenadas.slice(0, CONCLUIDAS_VISIVEIS),
      botao: (
        <button
          type="button"
          className="e-details-trigger"
          aria-expanded={abertas}
          onClick={() => setAbertas(!abertas)}
        >
          <span>
            {abertas
              ? "Mostrar menos"
              : `Mostrar todas as concluídas (${concluidas.length})`}
          </span>
          <Icon name={abertas ? "angle-small-up" : "angle-small-down"} />
        </button>
      ),
    };
  };
  return { recortar, abertas };
}
