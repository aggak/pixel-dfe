import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { atualizarTarefa } from "../api";
import { statusTexto } from "../design/formatos";
import type { Status, Tarefa } from "../tipos";
import { ALVOS_RESERVA, primeiroVisivel } from "./useRetornoFoco";

const TAREFA_GRAVADA = "pixel:tarefa-gravada";

// Grava o status na API e só então troca a tarefa no estado da página: o cartão muda de coluna com o valor confirmado.
export function useMudarStatus(tarefas: Tarefa[], setTarefas: Dispatch<SetStateAction<Tarefa[]>>) {
  const [aviso, setAviso] = useState("");
  const focar = useRef<string | null>(null);
  const carimbar = useRef<string | null>(null);
  // Toda página montada aplica a tarefa gravada, inclusive a visão aberta enquanto a resposta ainda vinha.
  useEffect(() => {
    const aplicar = (evento: Event) => {
      const gravada = (evento as CustomEvent<Tarefa>).detail;
      setTarefas((atuais) => atuais.map((t) => (t.id === gravada.id ? gravada : t)));
    };
    window.addEventListener(TAREFA_GRAVADA, aplicar);
    return () => window.removeEventListener(TAREFA_GRAVADA, aplicar);
  }, [setTarefas]);
  // No quadro o cartão remonta em outra coluna e o foco do botão se perde. O foco volta ao
  // seletor do cartão (ou ao título da página, se o filtro o tirou da tela), mas só se ninguém o levou para outro lugar.
  useEffect(() => {
    const idCarimbo = carimbar.current;
    carimbar.current = null;
    if (idCarimbo && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelector<SVGElement>(`[data-task-id="${CSS.escape(idCarimbo)}"] .e-paw`)?.animate([{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 240, easing: "ease-out" });
    }
    const id = focar.current;
    if (!id) return;
    focar.current = null;
    const cartao = `[data-task-id="${CSS.escape(id)}"]`;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !ativo.closest(cartao)) return;
    (document.querySelector<HTMLElement>(`${cartao} [data-status-trigger]`) ?? primeiroVisivel(ALVOS_RESERVA))?.focus();
  }, [tarefas]);
  const mudarStatus = useCallback(async (tarefa: Tarefa, status: Status) => {
    const gravada = await atualizarTarefa(tarefa.id, { status });
    focar.current = gravada.id;
    carimbar.current = tarefa.status !== "concluida" && gravada.status === "concluida" ? gravada.id : null;
    window.dispatchEvent(new CustomEvent(TAREFA_GRAVADA, { detail: gravada }));
    setAviso(`Status de ${tarefa.titulo} alterado para ${statusTexto[gravada.status]}.`);
  }, []);
  return { mudarStatus, aviso };
}
