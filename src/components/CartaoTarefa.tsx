import { useEffect, useRef, useState } from "react";
import { Button as AriaButton, Heading, useDrag } from "react-aria-components";
import { Link, useLocation, useNavigate } from "react-router";
import { Badge, BadgeWithDot, BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { ErroApi } from "../api";
import { STATUS } from "../derivar";
import type { Status, Tarefa } from "../tipos";
import { Icon, EditIcon, FolderIcon, TrashIcon, PawIcon } from "../design/icon";
import { formatarData, prioridadeTexto, statusTexto } from "../design/formatos";
import { MOVER_TAREFA, TIPO_TAREFA } from "./arrastar-tarefa";

// "lista" mostra a tarefa como linha; "quadro" como cartão empilhado na coluna do status.
// Com `onMudarStatus`, o selo de status vira um seletor; sem ele (página do projeto), segue só informativo.
export function CartaoTarefa({ tarefa, nomeProjeto, variante = "lista", onMudarStatus, onExcluir }: { tarefa: Tarefa; nomeProjeto?: string; variante?: "lista" | "quadro"; onMudarStatus?: (tarefa: Tarefa, status: Status) => Promise<void>; onExcluir: (tarefa: Tarefa) => Promise<void> }) {
  const [salvando, setSalvando] = useState(false);
  // "inexistente": a tarefa foi excluída em outro lugar e tentar de novo não adianta.
  const [falhou, setFalhou] = useState<false | "falha" | "inexistente">(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [falhaExclusao, setFalhaExclusao] = useState(false);
  const exclusaoPendente = useRef(false);
  // Trava síncrona: o estado `salvando` só vale no próximo render, e uma segunda escolha rápida passaria antes dele.
  const enviando = useRef(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const caminho = `/tarefas/${encodeURIComponent(tarefa.id)}`;
  const estado = { fundo: location };
  const emQuadro = variante === "quadro";
  const concluida = tarefa.status === "concluida";
  const classe = emQuadro ? `e-task e-card${!concluida && tarefa.prioridade === "alta" ? " e-card-high" : ""}${concluida ? " e-card-done" : ""}` : "e-task e-row";
  const SeloStatus = concluida ? BadgeWithIcon : BadgeWithDot;
  const tagStatus = <SeloStatus key="status" type="pill-color" size="sm" iconLeading={PawIcon} color={concluida ? "success" : tarefa.status === "a-fazer" ? "gray" : "brand"} className={`e-status e-status-${tarefa.status}`}>{statusTexto[tarefa.status]}</SeloStatus>;
  const mudar = async (status: Status) => {
    if (!onMudarStatus || status === tarefa.status || enviando.current) return;
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
  const excluir = async () => {
    if (exclusaoPendente.current) return;
    exclusaoPendente.current = true;
    setExcluindo(true);
    setFalhaExclusao(false);
    try {
      await onExcluir(tarefa);
      setConfirmando(false);
    } catch {
      setFalhaExclusao(true);
    } finally {
      exclusaoPendente.current = false;
      setExcluindo(false);
    }
  };
  // Soltar o cartão numa coluna chega aqui por evento; o ouvinte fica registrado uma vez e chama sempre a versão mais recente de `mudar`.
  const mudarAtual = useRef(mudar);
  useEffect(() => { mudarAtual.current = mudar; });
  useEffect(() => {
    const mover = (evento: Event) => {
      const { id, status } = (evento as CustomEvent<{ id: string; status: Status }>).detail;
      if (id === tarefa.id) void mudarAtual.current(status);
    };
    window.addEventListener(MOVER_TAREFA, mover);
    return () => window.removeEventListener(MOVER_TAREFA, mover);
  }, [tarefa.id]);
  const { dragProps } = useDrag({ getItems: () => [{ [TIPO_TAREFA]: tarefa.id, "text/plain": tarefa.titulo }], isDisabled: !emQuadro || !onMudarStatus });
  // Se o foco se perdeu durante o envio (o menu fecha e o devolve ao botão pendente), a falha o traz de volta, sem tirá-lo de outro controle.
  useEffect(() => {
    if (falhou && (!document.activeElement || document.activeElement === document.body)) gatilho.current?.focus();
  }, [falhou]);
  const seletorStatus = onMudarStatus ? <Dropdown.Root key="status">
    <AriaButton ref={gatilho} className="e-status-trigger" data-status-trigger aria-label={`Mudar status de ${tarefa.titulo} (atual: ${statusTexto[tarefa.status]})`} isPending={salvando}>{tagStatus}<Icon name="angle-small-down" /></AriaButton>
    <Dropdown.Popover className="e-popover" placement={emQuadro ? "bottom end" : "bottom start"}><Dropdown.Menu selectionMode="single" disallowEmptySelection shouldCloseOnSelect selectedKeys={[tarefa.status]} disabledKeys={salvando ? STATUS : undefined} onSelectionChange={(chaves) => { const [status] = chaves as Set<Status>; if (status) void mudar(status); }}>{STATUS.map((status) => <Dropdown.Item key={status} id={status} label={statusTexto[status]} />)}</Dropdown.Menu></Dropdown.Popover>
  </Dropdown.Root> : tagStatus;
  const tagPrioridade = <Badge key="prioridade" type="modern" size="sm" color="gray" className={`e-priority e-priority-${tarefa.prioridade}`}><Icon name={tarefa.prioridade === "alta" ? "angle-double-small-up" : tarefa.prioridade === "baixa" ? "arrow-small-down" : "minus-small"} />{prioridadeTexto[tarefa.prioridade]}</Badge>;
  return <article {...dragProps} className={classe} data-task-id={tarefa.id}>
    <div className="e-task-main"><div className="e-task-heading"><Link className="e-task-title" draggable={false} to={caminho} state={estado}>{tarefa.titulo}</Link>
      <Dropdown.Root><Button color="tertiary" size="sm" className="e-task-menu" aria-label={`Ações de ${tarefa.titulo}`}><Icon name="menu-dots-vertical" /></Button><Dropdown.Popover className="e-popover"><Dropdown.Menu aria-label={`Ações de ${tarefa.titulo}`}><Dropdown.Item id="editar" label="Editar tarefa" icon={EditIcon} onAction={() => navigate(`${caminho}/editar`, { state: estado })} /><Dropdown.Item id="excluir" className="e-danger-item" label="Excluir tarefa" icon={TrashIcon} onAction={() => { setFalhaExclusao(false); setConfirmando(true); }} /></Dropdown.Menu></Dropdown.Popover></Dropdown.Root>
    </div>{nomeProjeto && <span className="e-task-project"><FolderIcon />{nomeProjeto}</span>}<div className="e-task-meta"><span><Icon name="user" />{tarefa.responsavel}</span><span><Icon name="calendar" /><time dateTime={tarefa.prazo}>{formatarData(tarefa.prazo)}</time></span></div>
      {falhou && <p className="e-task-error" role="alert">{falhou === "inexistente" ? "Esta tarefa não existe mais. Ela pode ter sido excluída." : "Não foi possível mudar o status. Tente de novo."}</p>}</div>
    <div className="e-task-tags">{emQuadro ? [tagPrioridade, seletorStatus] : [seletorStatus, tagPrioridade]}</div>
    <ModalOverlay isOpen={confirmando} onOpenChange={(aberta) => { if (!aberta && !excluindo) setConfirmando(false); }} isDismissable={!excluindo} isKeyboardDismissDisabled={excluindo} className="e-confirm-overlay">
      <Modal className="e-confirm-modal"><Dialog className="e-confirm-dialog" aria-label={`Excluir ${tarefa.titulo}`}>
        <Heading slot="title">Excluir tarefa?</Heading>
        <p>Deseja excluir “{tarefa.titulo}”? Esta ação não pode ser desfeita.</p>
        {falhaExclusao && <p className="e-confirm-error" role="alert">Não foi possível excluir a tarefa. Tente novamente.</p>}
        <div className="e-confirm-actions"><Button color="secondary" size="sm" onClick={() => setConfirmando(false)} isDisabled={excluindo}>Cancelar</Button>{/* Pendente, e não desabilitado: o botão segura o foco durante o envio e, se falhar, Enter tenta de novo. */}<Button color="primary-destructive" size="sm" onClick={() => void excluir()} isLoading={excluindo} showTextWhileLoading>{excluindo ? "Excluindo…" : "Excluir tarefa"}</Button></div>
      </Dialog></Modal>
    </ModalOverlay>
  </article>;
}
