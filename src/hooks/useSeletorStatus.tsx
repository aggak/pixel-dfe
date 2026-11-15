import { useEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { ErroApi } from "../api";
import { STATUS } from "../derivar";
import type { Status, Tarefa } from "../tipos";
import { statusTexto } from "../design/formatos";
import { SeloStatus } from "../components/Selos";

export function useSeletorStatus(tarefa: Tarefa, onMudarStatus: (tarefa: Tarefa, status: Status) => Promise<void>, posicao: "bottom start" | "bottom end") {
  const [salvando, setSalvando] = useState(false);
  // "inexistente": a tarefa foi excluída em outro lugar e tentar de novo não adianta.
  const [falhou, setFalhou] = useState<false | "falha" | "inexistente">(false);
  // Trava síncrona: o estado `salvando` só vale no próximo render, e uma segunda escolha rápida passaria antes dele.
  const enviando = useRef(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const mudar = async (status: Status) => {
    if (status === tarefa.status || enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    setFalhou(false);
    try {
      await onMudarStatus(tarefa, status);
    } catch (erro) {
      setFalhou(erro instanceof ErroApi && erro.status === 404 ? "inexistente" : "falha");
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  };
  // Se o foco se perdeu durante o envio (o menu fecha e o devolve ao botão pendente), a falha o traz de volta, sem tirá-lo de outro controle.
  useEffect(() => {
    if (falhou && (!document.activeElement || document.activeElement === document.body)) gatilho.current?.focus();
  }, [falhou]);
  const seletorStatus = <Dropdown.Root key="status">
    <AriaButton ref={gatilho} className="e-status-trigger" data-status-trigger aria-label={`Mudar status de ${tarefa.titulo} (atual: ${statusTexto[tarefa.status]})`} isPending={salvando}><SeloStatus status={tarefa.status} seta /></AriaButton>
    <Dropdown.Popover className="e-popover" placement={posicao}><Dropdown.Menu selectionMode="single" disallowEmptySelection shouldCloseOnSelect selectedKeys={[tarefa.status]} disabledKeys={salvando ? STATUS : undefined} onSelectionChange={(chaves) => { const [status] = chaves as Set<Status>; if (status) void mudar(status); }}>{STATUS.map((status) => <Dropdown.Item key={status} id={status} label={statusTexto[status]} />)}</Dropdown.Menu></Dropdown.Popover>
  </Dropdown.Root>;
  const alerta = falhou && <p className="e-task-error" role="alert">{falhou === "inexistente" ? "Esta tarefa não existe mais. Ela pode ter sido excluída." : "Não foi possível mudar o status. Tente de novo."}</p>;
  return { seletorStatus, alerta };
}
