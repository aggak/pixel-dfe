import { useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { atualizarTarefa, ErroApi } from "../api";
import { statusTexto } from "../design/formatos";
import type { Status, Tarefa } from "../tipos";
import { ALVOS_RESERVA, primeiroVisivel } from "./useRetornoFoco";
import { ContextoPaginaAtiva } from "./useTituloPagina";

const TAREFA_GRAVADA = "pixel:tarefa-gravada";
const TAREFA_EXCLUIDA = "pixel:tarefa-excluida";

export function avisarTarefaGravada(gravada: Tarefa) {
  window.dispatchEvent(new CustomEvent(TAREFA_GRAVADA, { detail: gravada }));
}
export function avisarTarefaExcluida(excluida: Tarefa, inexistente = false) {
  window.dispatchEvent(new CustomEvent(TAREFA_EXCLUIDA, { detail: { ...excluida, inexistente } }));
}
export function avisoStatus(titulo: string, status: Status) {
  return `Status de ${titulo} alterado para ${statusTexto[status]}.`;
}

// Grava o status na API e só então troca a tarefa no estado da página: o cartão muda de coluna com o valor confirmado.
export function useMudarStatus(tarefas: Tarefa[], setTarefas: Dispatch<SetStateAction<Tarefa[]>>, aoGravar?: (gravada: Tarefa) => boolean) {
  const [aviso, setAviso] = useState("");
  const [inexistente, setInexistente] = useState("");
  const alertaInexistente = useRef<HTMLParagraphElement>(null);
  const focar = useRef<string | null>(null);
  const focarAviso = useRef(false);
  const carimbar = useRef<string | null>(null);
  const ativa = useContext(ContextoPaginaAtiva);
  const avisoPendente = useRef("");
  // Toda página montada aplica a tarefa gravada, inclusive a visão aberta enquanto a resposta ainda vinha.
  useEffect(() => {
    const aplicar = (evento: Event) => {
      const gravada = (evento as CustomEvent<Tarefa>).detail;
      setTarefas((atuais) => atuais.map((t) => (t.id === gravada.id ? gravada : t)));
    };
    const remover = (evento: Event) => {
      const excluida = (evento as CustomEvent<Tarefa & { inexistente: boolean }>).detail;
      if (excluida.inexistente) {
        setInexistente(`“${excluida.titulo}” não existe mais. Ela pode ter sido excluída.`);
        focar.current = excluida.id;
        focarAviso.current = true;
      }
      setTarefas((atuais) => atuais.filter((t) => t.id !== excluida.id));
      avisoPendente.current = excluida.inexistente ? "" : `Tarefa ${excluida.titulo} excluída.`;
    };
    window.addEventListener(TAREFA_GRAVADA, aplicar);
    window.addEventListener(TAREFA_EXCLUIDA, remover);
    return () => {
      window.removeEventListener(TAREFA_GRAVADA, aplicar);
      window.removeEventListener(TAREFA_EXCLUIDA, remover);
    };
  }, [setTarefas]);
  useEffect(() => {
    if (!ativa || !avisoPendente.current) return;
    setAviso(avisoPendente.current);
    avisoPendente.current = "";
  }, [ativa]);
  // No quadro o cartão remonta em outra coluna e o foco do botão se perde. O foco volta ao
  // seletor do cartão (ou ao título da página, se o filtro o tirou da tela), mas só se ninguém o levou para outro lugar.
  useEffect(() => {
    const idCarimbo = carimbar.current;
    carimbar.current = null;
    if (idCarimbo && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelector<SVGElement>(`[data-task-id="${CSS.escape(idCarimbo)}"] .e-paw`)?.animate([{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 240, easing: "ease-out" });
    }
    const id = focar.current;
    const noAviso = focarAviso.current;
    focarAviso.current = false;
    focar.current = null;
    if (!id || !ativa) return;
    const cartao = `[data-task-id="${CSS.escape(id)}"]`;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !ativo.closest(cartao)) return;
    (document.querySelector<HTMLElement>(`${cartao} [data-status-trigger]`) ?? (noAviso ? alertaInexistente.current : null) ?? primeiroVisivel(ALVOS_RESERVA))?.focus();
  }, [tarefas, ativa]);
  const mudarStatus = useCallback(async (tarefa: Tarefa, status: Status) => {
    let gravada: Tarefa;
    try {
      gravada = await atualizarTarefa(tarefa.id, { status });
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 404) avisarTarefaExcluida(tarefa, true);
      throw erro;
    }
    focar.current = gravada.id;
    carimbar.current = tarefa.status !== "concluida" && gravada.status === "concluida" ? gravada.id : null;
    avisarTarefaGravada(gravada);
    setAviso(aoGravar?.(gravada) ? "" : avisoStatus(tarefa.titulo, gravada.status));
  }, [aoGravar]);
  return { mudarStatus, aviso, inexistente, alertaInexistente };
}
