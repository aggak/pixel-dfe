import { useEffect, useRef, useState, type ReactNode } from "react";
import { isTextDropItem, useDrop } from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import { AnimarPosicoes } from "../components/AnimarPosicoes";
import { useFiltros } from "../components/filtros-contexto";
import { GatinhoLavando } from "../components/GatinhoLavando";
import { VisaoTarefas } from "../components/VisaoTarefas";
import { agruparPorStatus, ordenarPorOrdem } from "../derivar";
import { statusTexto } from "../design/formatos";
import { Icon } from "../design/icon";
import { soltarTarefa, TIPO_TAREFA } from "../hooks/arrastar-tarefa";
import { atualizarTarefa, listarTarefas } from "../api";
import { avisarTarefaGravada } from "../hooks/useMudarStatus";
import type { Status, Tarefa } from "../tipos";
import { useConcluidasRecolhidas } from "../hooks/useConcluidasRecolhidas";

const iconesStatus: Record<Status, string> = {
  "a-fazer": "circle",
  "em-andamento": "play",
  "em-revisao": "eye",
  concluida: "check",
};

type Ancora = { antes?: string; depois?: string };

function ancoraNoPonto(coluna: HTMLElement, y: number): Ancora {
  const topo = coluna.getBoundingClientRect().top + y;
  const cartoes = [
    ...coluna.querySelectorAll<HTMLElement>("[data-task-id]"),
  ].filter((cartao) => !cartao.classList.contains("e-card-arrastando"));
  const antes = cartoes.find((cartao) => {
    const caixa = cartao.getBoundingClientRect();
    return topo < caixa.top + caixa.height / 2;
  });
  if (antes) return { antes: antes.dataset.taskId };
  return { depois: cartoes.at(-1)?.dataset.taskId };
}

function Coluna({
  status,
  onSoltar,
  children,
}: {
  status: Status;
  onSoltar: (
    id: string,
    status: Status,
    ancora: Ancora,
    statusSalvo: Promise<boolean>,
  ) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [alvo, setAlvo] = useState<Ancora>();
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: (tipos) => (tipos.has(TIPO_TAREFA) ? "move" : "cancel"),
    onDropMove: ({ y }) => {
      if (!ref.current) return;
      const ancora = ancoraNoPonto(ref.current, y);
      setAlvo((atual) =>
        atual?.antes === ancora.antes && atual?.depois === ancora.depois
          ? atual
          : ancora,
      );
    },
    onDropExit: () => setAlvo(undefined),
    onDrop: async ({ items, y }) => {
      setAlvo(undefined);
      const item = items.find(
        (atual) => isTextDropItem(atual) && atual.types.has(TIPO_TAREFA),
      );
      if (!item || !isTextDropItem(item) || !ref.current) return;
      const id = await item.getText(TIPO_TAREFA);
      const ancora = ancoraNoPonto(ref.current, y);
      onSoltar(id, status, ancora, soltarTarefa(id, status));
    },
  });
  useEffect(() => {
    const coluna = ref.current;
    if (!coluna || !isDropTarget || !alvo) return;
    const id = alvo.antes ?? alvo.depois;
    const cartao = id
      ? coluna.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`)
      : null;
    const classe = alvo.antes ? "e-card-soltar-antes" : "e-card-soltar-depois";
    cartao?.classList.add(classe);
    return () => cartao?.classList.remove(classe);
  }, [alvo, isDropTarget]);
  return (
    <section
      {...dropProps}
      ref={ref}
      className={`e-column${isDropTarget ? " e-column-alvo" : ""}`}
      aria-label={statusTexto[status]}
      data-status-column={status}
    >
      {children}
    </section>
  );
}

function Quadro({
  tarefas,
  cartao,
  todasTarefas,
}: {
  tarefas: Tarefa[];
  cartao: (tarefa: Tarefa, variante?: "lista" | "quadro") => ReactNode;
  todasTarefas: Tarefa[];
}) {
  const [ordemLocal, setOrdemLocal] = useState<Record<string, number>>({});
  const [falhaOrdem, setFalhaOrdem] = useState(false);
  const rodada = useRef(0);
  const { filtros } = useFiltros();
  const aplicar = (lista: Tarefa[]) =>
    lista.map((tarefa) =>
      tarefa.id in ordemLocal
        ? { ...tarefa, ordem: ordemLocal[tarefa.id] }
        : tarefa,
    );
  const todas = aplicar(todasTarefas);
  const { recortar, abertas, posicionadas, definirPosicionadas } =
    useConcluidasRecolhidas(todasTarefas);
  const soltar = (
    id: string,
    status: Status,
    ancora: Ancora,
    statusSalvo: Promise<boolean>,
  ) => {
    const coluna = ordenarPorOrdem(
      todas.filter((tarefa) => tarefa.status === status),
    );
    const concluidaAberta = status === "concluida" && abertas;
    const ordenadas = concluidaAberta ? recortar(coluna).visiveis : coluna;
    const ids = ordenadas.map((tarefa) => tarefa.id).filter((tid) => tid !== id);
    const ancorada = ancora.antes ?? ancora.depois;
    const posicao = ancorada ? ids.indexOf(ancorada) : -1;
    const indice =
      posicao < 0 ? ids.length : ancora.antes ? posicao : posicao + 1;
    ids.splice(indice, 0, id);
    const anteriores = new Map(
      todas.map((tarefa) => [tarefa.id, tarefa.ordem]),
    );
    const mudadas = ids.flatMap((tid, ordem) =>
      anteriores.get(tid) === ordem ? [] : [[tid, ordem] as const],
    );
    if (concluidaAberta)
      void statusSalvo.then((salvo) => {
        if (salvo)
          definirPosicionadas(
            ids.filter((tid, i) => i >= indice || posicionadas.includes(tid)),
          );
      });
    if (mudadas.length === 0) return;
    const minha = ++rodada.current;
    setFalhaOrdem(false);
    setOrdemLocal((atual) => ({ ...atual, ...Object.fromEntries(mudadas) }));
    void salvarOrdem(mudadas, anteriores, minha, statusSalvo);
  };
  const salvarOrdem = async (
    mudadas: (readonly [string, number])[],
    anteriores: Map<string, number | undefined>,
    minha: number,
    statusSalvo: Promise<boolean>,
  ) => {
    if (!(await statusSalvo)) return restaurar(mudadas, anteriores, minha);
    const resultados = await Promise.allSettled(
      mudadas.map(([tid, ordem]) =>
        atualizarTarefa(tid, { ordem }).then(avisarTarefaGravada),
      ),
    );
    if (resultados.every((resultado) => resultado.status === "fulfilled"))
      return;
    setFalhaOrdem(true);
    const salvas = await listarTarefas().then(
      (lista) => new Map(lista.map((tarefa) => [tarefa.id, tarefa.ordem])),
      () => anteriores,
    );
    restaurar(mudadas, salvas, minha);
  };
  const restaurar = (
    mudadas: (readonly [string, number])[],
    salvas: Map<string, number | undefined>,
    minha: number,
  ) => {
    if (rodada.current !== minha) return;
    definirPosicionadas(posicionadas);
    setOrdemLocal((atual) => {
      const proxima = { ...atual };
      for (const [tid] of mudadas) {
        const ordem = salvas.get(tid);
        if (ordem === undefined) delete proxima[tid];
        else proxima[tid] = ordem;
      }
      return proxima;
    });
  };
  return (
    <>
      {falhaOrdem && (
        <p className="e-task-error" role="alert" tabIndex={-1}>
          Não foi possível salvar a nova ordem. O quadro voltou à ordem salva.
        </p>
      )}
      <AnimarPosicoes
        classe="e-board"
        rotulo="Quadro de tarefas por status"
        seletor=":scope > .e-column > .e-card[data-task-id]"
        tarefas={todas}
        filtros={filtros}
        concluidasAbertas={abertas}
        considerarOrdem
      >
        {agruparPorStatus(ordenarPorOrdem(aplicar(tarefas))).map((coluna) => {
          const { visiveis, botao } =
            coluna.status === "concluida"
              ? recortar(coluna.tarefas)
              : { visiveis: coluna.tarefas, botao: null };
          return (
            <Coluna
              key={coluna.status}
              status={coluna.status}
              onSoltar={soltar}
            >
              <h2>
                <span className="e-column-name">
                  <Icon name={iconesStatus[coluna.status]} />
                  <span>{statusTexto[coluna.status]}</span>
                </span>
                <Badge type="modern" color="gray" size="sm">
                  {coluna.tarefas.length}
                </Badge>
              </h2>
              {visiveis.map((tarefa) => cartao(tarefa, "quadro"))}
              {botao}
              {coluna.tarefas.length === 0 && (
                <p className="e-column-empty">
                  <GatinhoLavando />
                  {todasTarefas.some(
                    (tarefa) => tarefa.status === coluna.status,
                  )
                    ? "Nenhuma tarefa encontrada"
                    : "Nenhuma tarefa"}
                </p>
              )}
            </Coluna>
          );
        })}
      </AnimarPosicoes>
    </>
  );
}

export function QuadroTarefas() {
  return (
    <VisaoTarefas titulo="Quadro" classeConteudo="e-content e-board-content">
      {(tarefas, cartao, todasTarefas) => (
        <Quadro tarefas={tarefas} cartao={cartao} todasTarefas={todasTarefas} />
      )}
    </VisaoTarefas>
  );
}
