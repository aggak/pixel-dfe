import { useContext, useEffect, useRef } from "react";
import { useDrag } from "react-aria-components";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import type { Status, Tarefa } from "../tipos";
import { Icon, EditIcon, FolderIcon, TrashIcon } from "../design/icon";
import { formatarData, formatarPrazoCartao } from "../design/formatos";
import { SeloPrioridade } from "./Selos";
import { ALVOS_RESERVA, primeiroVisivel } from "../hooks/useRetornoFoco";
import { useSeletorStatus } from "../hooks/useSeletorStatus";
import { useExcluirEmDoisToques } from "../hooks/useExcluirEmDoisToques";
import { ouvirSoltura, TIPO_TAREFA } from "../hooks/arrastar-tarefa";
import { ContextoTarefaAberta } from "./ficha-contexto";

export function CartaoTarefa({
  tarefa,
  nomeProjeto,
  variante = "lista",
  onMudarStatus,
  onExcluir,
}: {
  tarefa: Tarefa;
  nomeProjeto?: string;
  variante?: "lista" | "quadro";
  onMudarStatus: (tarefa: Tarefa, status: Status) => Promise<void>;
  onExcluir: (tarefa: Tarefa) => Promise<void>;
}) {
  const fichaAberta = useContext(ContextoTarefaAberta) === tarefa.id;
  const location = useLocation();
  const navigate = useNavigate();
  const caminho = `/tarefas/${encodeURIComponent(tarefa.id)}`;
  const estado = { fundo: location };
  const emQuadro = variante === "quadro";
  const concluida = tarefa.status === "concluida";
  const { dragProps, isDragging } = useDrag({
    getItems: () => [{ [TIPO_TAREFA]: tarefa.id, "text/plain": tarefa.titulo }],
  });
  const arrastavel = emQuadro
    ? {
        draggable: true,
        onDragStart: dragProps.onDragStart,
        onDrag: dragProps.onDrag,
        onDragEnd: dragProps.onDragEnd,
      }
    : {};
  const { seletorStatus, alerta, mudar } = useSeletorStatus(
    tarefa,
    onMudarStatus,
    emQuadro ? "bottom end" : "bottom start",
  );
  const raiz = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!emQuadro) return;
    return ouvirSoltura(({ id, status, responder }) => {
      if (id === tarefa.id) responder(mudar(status));
    });
  });
  const focarVizinho = () => {
    const cartoes = [
      ...document.querySelectorAll<HTMLElement>("[data-task-id]"),
    ];
    const posicao = raiz.current ? cartoes.indexOf(raiz.current) : -1;
    const vizinho =
      posicao < 0 ? undefined : (cartoes[posicao + 1] ?? cartoes[posicao - 1]);
    const alvo = vizinho?.querySelector<HTMLElement>(".e-task-title");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const ativo = document.activeElement;
        if (ativo && ativo !== document.body && ativo.isConnected) return;
        (alvo?.isConnected ? alvo : primeiroVisivel(ALVOS_RESERVA))?.focus();
      }),
    );
  };
  const exclusao = useExcluirEmDoisToques(async () => {
    await onExcluir(tarefa);
    focarVizinho();
  });
  const classe = `e-task ${emQuadro ? "e-card" : "e-row"}${concluida ? " e-task-done" : ""}${isDragging ? " e-card-arrastando" : ""}${exclusao.excluindo ? " e-task-saindo" : ""}`;
  const avisoExclusao = exclusao.falha && (
    <p className="e-task-error" role="alert">
      Não foi possível excluir a tarefa. Tente de novo.
    </p>
  );
  const tagPrioridade = (
    <SeloPrioridade key="prioridade" prioridade={tarefa.prioridade} />
  );
  const cabecalho = (
    <div className="e-task-heading">
      <Link
        className="e-task-title"
        to={caminho}
        state={estado}
        draggable={false}
      >
        {tarefa.titulo}
      </Link>
      <Dropdown.Root
        onOpenChange={(aberto) => {
          if (!aberto) exclusao.desarmar();
        }}
      >
        <Button
          color="tertiary"
          size="sm"
          className="e-task-menu"
          aria-label={`Ações de ${tarefa.titulo}`}
        >
          <Icon name="menu-dots-vertical" />
        </Button>
        <Dropdown.Popover className="e-popover">
          <Dropdown.Menu aria-label={`Ações de ${tarefa.titulo}`}>
            <Dropdown.Item
              id="editar"
              label="Editar tarefa"
              icon={EditIcon}
              onAction={() => navigate(`${caminho}/editar`, { state: estado })}
            />
            <Dropdown.Item
              id="excluir"
              label={exclusao.armado ? "Confirmar exclusão" : "Excluir tarefa"}
              icon={TrashIcon}
              className={exclusao.armado ? "e-excluir-armado" : undefined}
              data-pronto={exclusao.pronto || undefined}
              shouldCloseOnSelect={exclusao.pronto}
              onAction={() => void exclusao.tocar()}
            />
          </Dropdown.Menu>
          {exclusao.armado && (
            <span className="sr-only" role="status">
              Pressione de novo para excluir {tarefa.titulo}. Esta ação não pode
              ser desfeita.
            </span>
          )}
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
  const pessoaPrazo = (
    <>
      <span className="e-card-pessoa">{tarefa.responsavel}</span>
      <span className="e-card-separador" aria-hidden="true">
        ·
      </span>
      <time
        className="e-card-prazo"
        dateTime={tarefa.prazo}
        title={`Prazo: ${formatarData(tarefa.prazo, true)}`}
      >
        {formatarPrazoCartao(tarefa.prazo)}
      </time>
    </>
  );
  return (
    <article
      {...arrastavel}
      ref={raiz}
      className={classe}
      data-task-id={tarefa.id}
      data-ficha-aberta={fichaAberta || undefined}
    >
      {emQuadro ? (
        <div className="e-task-main">
          {cabecalho}
          <div className="e-card-contexto">
            {nomeProjeto ? (
              <span className="e-task-project">{nomeProjeto}</span>
            ) : (
              <span />
            )}
            {seletorStatus}
          </div>
          <div
            className={`e-task-meta${tarefa.responsavel.length > 24 ? " e-card-meta-longa" : ""}`}
          >
            {pessoaPrazo}
            {tagPrioridade}
          </div>
          {alerta}
          {avisoExclusao}
        </div>
      ) : (
        <>
          <div className="e-task-main">
            {cabecalho}
            <div className="e-task-meta e-read-meta">
              {nomeProjeto && (
                <p>
                  <FolderIcon />
                  <span className="e-task-project">{nomeProjeto}</span>
                </p>
              )}
              <p>
                <Icon name="user" />
                <span>{tarefa.responsavel}</span>
              </p>
              <p>
                <Icon name="calendar" />
                <time
                  dateTime={tarefa.prazo}
                  title={`Prazo: ${formatarData(tarefa.prazo, true)}`}
                >
                  {formatarPrazoCartao(tarefa.prazo)}
                </time>
              </p>
            </div>
            {alerta}
            {avisoExclusao}
          </div>
          <div className="e-task-tags">
            {seletorStatus}
            {tagPrioridade}
          </div>
        </>
      )}
    </article>
  );
}
