import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import type { Status, Tarefa } from "../tipos";
import { Icon, EditIcon, TrashIcon } from "../design/icon";
import {
  formatarData,
  formatarPrazoCartao,
  prazoVencido,
} from "../design/formatos";
import { SeloPrioridade } from "./Selos";
import { ConfirmarExclusao } from "./ConfirmarExclusao";
import { ALVOS_RESERVA, primeiroVisivel } from "../hooks/useRetornoFoco";
import { useSeletorStatus } from "../hooks/useSeletorStatus";

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
  const [confirmando, setConfirmando] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const caminho = `/tarefas/${encodeURIComponent(tarefa.id)}`;
  const estado = { fundo: location };
  const emQuadro = variante === "quadro";
  const concluida = tarefa.status === "concluida";
  const classe = `e-task ${emQuadro ? "e-card" : "e-row"}${concluida ? " e-task-done" : ""}`;
  const { seletorStatus, alerta } = useSeletorStatus(
    tarefa,
    onMudarStatus,
    emQuadro ? "bottom end" : "bottom start",
  );
  const raiz = useRef<HTMLElement>(null);
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
  const excluir = async () => {
    await onExcluir(tarefa);
    setConfirmando(false);
    focarVizinho();
  };
  const tagPrioridade = (
    <SeloPrioridade key="prioridade" prioridade={tarefa.prioridade} />
  );
  const cabecalho = (
    <div className="e-task-heading">
      <Link className="e-task-title" to={caminho} state={estado}>
        {tarefa.titulo}
      </Link>
      <Dropdown.Root>
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
              label="Excluir tarefa"
              icon={TrashIcon}
              onAction={() => setConfirmando(true)}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
  const vencido = !concluida && prazoVencido(tarefa.prazo);
  const pessoaPrazo = (
    <>
      <span className="e-card-pessoa">{tarefa.responsavel}</span>
      <span className="e-card-separador" aria-hidden="true">
        ·
      </span>
      <time
        className={`e-card-prazo${vencido ? " e-card-vencido" : ""}`}
        dateTime={tarefa.prazo}
        title={`Prazo: ${formatarData(tarefa.prazo, true)}`}
      >
        {vencido ? "Venceu " : ""}
        {formatarPrazoCartao(tarefa.prazo)}
      </time>
    </>
  );
  return (
    <article ref={raiz} className={classe} data-task-id={tarefa.id}>
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
        </div>
      ) : (
        <>
          <div className="e-task-main">
            {cabecalho}
            {nomeProjeto && (
              <span className="e-task-project">{nomeProjeto}</span>
            )}
            <div className="e-task-meta">{pessoaPrazo}</div>
            {alerta}
          </div>
          <div className="e-task-tags">
            {seletorStatus}
            {tagPrioridade}
          </div>
        </>
      )}
      <ConfirmarExclusao
        tarefa={tarefa}
        aberta={confirmando}
        onFechar={() => setConfirmando(false)}
        onExcluir={excluir}
      />
    </article>
  );
}
