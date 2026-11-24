import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { atualizarTarefa, ErroApi } from "../api";
import { statusTexto } from "../design/formatos";
import type { Status, Tarefa } from "../tipos";
import { ALVOS_RESERVA, primeiroVisivel } from "./useRetornoFoco";
import { movimentoReduzido } from "./useMovimento";
import { ContextoPaginaAtiva } from "./useTituloPagina";

const TAREFA_GRAVADA = "pixel:tarefa-gravada";
const ORDEM_GRAVADA = "pixel:ordem-gravada";
const TAREFA_EXCLUIDA = "pixel:tarefa-excluida";

type OrdemGravada = Pick<Tarefa, "id" | "ordem">;

export function avisarTarefaGravada(gravada: Tarefa) {
  window.dispatchEvent(new CustomEvent(TAREFA_GRAVADA, { detail: gravada }));
}
export function avisarOrdemGravada({ id, ordem }: OrdemGravada) {
  window.dispatchEvent(
    new CustomEvent(ORDEM_GRAVADA, { detail: { id, ordem } }),
  );
}
export function avisarTarefaExcluida(excluida: Tarefa, inexistente = false) {
  window.dispatchEvent(
    new CustomEvent(TAREFA_EXCLUIDA, { detail: { ...excluida, inexistente } }),
  );
}
export function avisoExclusao(titulo: string) {
  return `Tarefa ${titulo} excluída.`;
}
export function avisoStatus(titulo: string, status: Status) {
  return `Status de ${titulo} alterado para ${statusTexto[status]}.`;
}

export function useMudarStatus(
  tarefas: Tarefa[],
  setTarefas: Dispatch<SetStateAction<Tarefa[]>>,
  aoGravar?: (gravada: Tarefa) => boolean,
) {
  const [aviso, setAviso] = useState("");
  const [inexistente, setInexistente] = useState("");
  const alertaInexistente = useRef<HTMLParagraphElement>(null);
  const focar = useRef<string | null>(null);
  const focarAviso = useRef(false);
  const carimbar = useRef<string | null>(null);
  const ativa = useContext(ContextoPaginaAtiva);
  const avisoPendente = useRef("");
  useEffect(() => {
    const aplicar = (evento: Event) => {
      const gravada = (evento as CustomEvent<Tarefa>).detail;
      setTarefas((atuais) =>
        atuais.map((t) => (t.id === gravada.id ? gravada : t)),
      );
    };
    const aplicarOrdem = (evento: Event) => {
      const { id, ordem } = (evento as CustomEvent<OrdemGravada>).detail;
      setTarefas((atuais) =>
        atuais.map((t) => (t.id === id ? { ...t, ordem } : t)),
      );
    };
    const remover = (evento: Event) => {
      const excluida = (
        evento as CustomEvent<Tarefa & { inexistente: boolean }>
      ).detail;
      if (excluida.inexistente) {
        setInexistente(
          `“${excluida.titulo}” não existe mais. Ela pode ter sido excluída.`,
        );
        focar.current = excluida.id;
        focarAviso.current = true;
      }
      setTarefas((atuais) => atuais.filter((t) => t.id !== excluida.id));
      avisoPendente.current = excluida.inexistente
        ? ""
        : avisoExclusao(excluida.titulo);
    };
    window.addEventListener(TAREFA_GRAVADA, aplicar);
    window.addEventListener(ORDEM_GRAVADA, aplicarOrdem);
    window.addEventListener(TAREFA_EXCLUIDA, remover);
    return () => {
      window.removeEventListener(TAREFA_GRAVADA, aplicar);
      window.removeEventListener(ORDEM_GRAVADA, aplicarOrdem);
      window.removeEventListener(TAREFA_EXCLUIDA, remover);
    };
  }, [setTarefas]);
  useEffect(() => {
    if (!ativa || !avisoPendente.current) return;
    setAviso(avisoPendente.current);
    avisoPendente.current = "";
  }, [ativa]);
  useEffect(() => {
    const idCarimbo = carimbar.current;
    carimbar.current = null;
    if (idCarimbo && !movimentoReduzido()) {
      document
        .querySelector<SVGElement>(
          `[data-task-id="${CSS.escape(idCarimbo)}"] .e-paw`,
        )
        ?.animate(
          [
            { transform: "scale(1.5)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: 240, easing: "ease-out" },
        );
    }
    const id = focar.current;
    const noAviso = focarAviso.current;
    focarAviso.current = false;
    focar.current = null;
    if (!id || !ativa) return;
    const cartao = `[data-task-id="${CSS.escape(id)}"]`;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !ativo.closest(cartao)) return;
    (
      document.querySelector<HTMLElement>(`${cartao} [data-status-trigger]`) ??
      (noAviso ? alertaInexistente.current : null) ??
      primeiroVisivel(ALVOS_RESERVA)
    )?.focus();
  }, [tarefas, ativa]);
  const mudarStatus = useCallback(
    async (tarefa: Tarefa, status: Status) => {
      let gravada: Tarefa;
      try {
        gravada = await atualizarTarefa(tarefa.id, { status });
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 404)
          avisarTarefaExcluida(tarefa, true);
        throw erro;
      }
      focar.current = gravada.id;
      carimbar.current =
        tarefa.status !== "concluida" && gravada.status === "concluida"
          ? gravada.id
          : null;
      avisarTarefaGravada(gravada);
      setAviso(
        aoGravar?.(gravada) ? "" : avisoStatus(tarefa.titulo, gravada.status),
      );
    },
    [aoGravar],
  );
  const avisarExclusao = useCallback(
    (tarefa: Tarefa) => setAviso(avisoExclusao(tarefa.titulo)),
    [],
  );
  return { mudarStatus, avisarExclusao, aviso, inexistente, alertaInexistente };
}
