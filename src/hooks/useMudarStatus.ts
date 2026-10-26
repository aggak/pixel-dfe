import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { atualizarTarefa } from "../api";
import { statusTexto } from "../design/formatos";
import type { Status, Tarefa } from "../tipos";

const TAREFA_GRAVADA = "pixel:tarefa-gravada";

// Grava o status na API e só então troca a tarefa no estado da página: o cartão muda de coluna com o valor confirmado.
export function useMudarStatus(tarefas: Tarefa[], setTarefas: Dispatch<SetStateAction<Tarefa[]>>) {
  const [aviso, setAviso] = useState("");
  const focar = useRef<string | null>(null);
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
    const id = focar.current;
    if (!id) return;
    focar.current = null;
    const cartao = `[data-task-id="${CSS.escape(id)}"]`;
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !ativo.closest(cartao)) return;
    (document.querySelector<HTMLElement>(`${cartao} [data-status-trigger]`) ?? document.querySelector<HTMLElement>("main h1"))?.focus();
  }, [tarefas]);
  const mudarStatus = useCallback(async (tarefa: Tarefa, status: Status) => {
    const gravada = await atualizarTarefa(tarefa.id, { status });
    focar.current = gravada.id;
    window.dispatchEvent(new CustomEvent(TAREFA_GRAVADA, { detail: gravada }));
    setAviso(`Status de ${tarefa.titulo} alterado para ${statusTexto[gravada.status]}.`);
  }, []);
  return { mudarStatus, aviso };
}
