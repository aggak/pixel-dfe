import { useCallback, useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import {
  atualizarTarefa,
  buscarTarefa,
  excluirTarefaSeExistir,
  listarProjetos,
  ErroApi,
} from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import {
  avisarTarefaExcluida,
  avisarTarefaGravada,
  avisoStatus,
} from "../hooks/useMudarStatus";
import { useSeletorStatus } from "../hooks/useSeletorStatus";
import { GatinhoCochilando } from "../components/GatinhoCochilando";
import { GatinhoAbanando } from "../components/GatinhoAbanando";
import { useFicha } from "../components/ficha-contexto";
import { FolhaPrazo } from "../components/FolhaPrazo";
import {
  AvisoCompacto,
  Carregando,
  ErroCarregamento,
} from "../components/Layout";
import { SeloPrioridade } from "../components/Selos";
import { Icon, FolderIcon, EditIcon, TrashIcon } from "../design/icon";
import { useExcluirEmDoisToques } from "../hooks/useExcluirEmDoisToques";
import { formatarData, lerPrazo } from "../design/formatos";
import type { Status, Tarefa } from "../tipos";

function EtiquetasTarefa({
  tarefa,
  onMudarStatus,
}: {
  tarefa: Tarefa;
  onMudarStatus: (tarefa: Tarefa, status: Status) => Promise<void>;
}) {
  const { seletorStatus, alerta } = useSeletorStatus(
    tarefa,
    onMudarStatus,
    "bottom start",
  );
  return (
    <>
      <div className="e-read-tags">
        {seletorStatus}
        <SeloPrioridade prioridade={tarefa.prioridade} />
      </div>
      {alerta}
    </>
  );
}

export function DetalheTarefa() {
  const { id = "" } = useParams();
  const consultar = useCallback(
    (signal: AbortSignal) => buscarTarefa(id, signal),
    [id],
  );
  const {
    dados: lida,
    erro,
    carregando,
    tentando,
    tentarDeNovo,
  } = useConsulta(consultar);
  const [gravada, setGravada] = useState<Tarefa>();
  const tarefa = gravada ?? lida;
  useTituloPagina(
    erro instanceof ErroApi && erro.status === 404
      ? "Tarefa não encontrada"
      : (tarefa?.titulo ?? "Tarefa"),
  );
  const {
    dados: projetos,
    erro: erroProjetos,
    carregando: carregandoProjetos,
    tentando: tentandoProjetos,
    tentarDeNovo: tentarProjetos,
  } = useConsulta(listarProjetos);
  const { navegar, destinoFechar, setOcupada } = useFicha();
  const [aviso, setAviso] = useState("");
  const mudarStatus = async (atual: Tarefa, status: Status) => {
    let nova: Tarefa;
    try {
      nova = await atualizarTarefa(atual.id, { status });
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 404)
        avisarTarefaExcluida(atual, true);
      throw erro;
    }
    setGravada(nova);
    avisarTarefaGravada(nova);
    setAviso(avisoStatus(atual.titulo, nova.status));
  };
  const excluir = async () => {
    if (!tarefa) return;
    setOcupada(true);
    try {
      await excluirTarefaSeExistir(tarefa.id);
    } finally {
      setOcupada(false);
    }
    const cartoes = [
      ...document.querySelectorAll<HTMLElement>("[data-task-id]"),
    ];
    const posicao = cartoes.findIndex(
      (cartao) => cartao.dataset.taskId === tarefa.id,
    );
    const vizinho =
      posicao < 0 ? undefined : (cartoes[posicao + 1] ?? cartoes[posicao - 1]);
    avisarTarefaExcluida(tarefa);
    navegar(
      destinoFechar,
      false,
      undefined,
      vizinho
        ? [
            `[data-task-id="${CSS.escape(vizinho.dataset.taskId ?? "")}"] .e-task-title`,
          ]
        : [],
    );
  };
  const exclusao = useExcluirEmDoisToques(excluir);
  const projeto =
    tarefa && projetos?.find((item) => item.id === tarefa.projetoId);
  const projetoInexistente =
    tarefa !== undefined && projetos !== undefined && !projeto;
  /* A ficha gira em torno do dia da entrega: a folha de calendário mostra a
     data e a frase sob o título diz quanto falta e em que dia da semana cai.
     Concluída, a folha continua igual: quem diz "Concluída" é o selo, e a
     frase só lembra que aquele dia é o prazo, não o dia em que terminou. */
  const concluida = tarefa?.status === "concluida";
  const prazo = tarefa && lerPrazo(tarefa.prazo, concluida);
  const descricao = tarefa?.descricao.trim();
  return (
    <section className="e-read-task fol" aria-label="Dados da tarefa">
      <div className="e-panel-scroll">
        {carregando && (
          <>
            <div className="e-ficha-gato">
              <GatinhoAbanando />
            </div>
            <p className="e-ficha-state" role="status">
              Carregando tarefa…
            </p>
          </>
        )}
        {erro instanceof ErroApi && erro.status === 404 && (
          <>
            <div className="e-ficha-gato">
              <GatinhoCochilando />
            </div>
            <p className="e-ficha-state e-form-error" role="alert">
              Tarefa não encontrada. Ela pode ter sido excluída.
            </p>
          </>
        )}
        {erro !== undefined &&
          !(erro instanceof ErroApi && erro.status === 404) && (
            <ErroCarregamento
              compacto
              titulo="Não foi possível carregar a tarefa"
              erro={erro}
              onTentarDeNovo={() => {
                tentarDeNovo();
                if (erroProjetos !== undefined) tentarProjetos();
              }}
              tentando={tentando}
            />
          )}
        {tarefa && (
          <div className="e-read-body">
            <div
              className={`fol-topo${prazo ? "" : " sem-folha"}`}
              data-prazo={prazo?.estado}
            >
              {prazo && <FolhaPrazo dia={prazo.dia} mes={prazo.mes} />}
              <h2 className="e-read-title">{tarefa.titulo}</h2>
              <p className="fol-prazo">
                {prazo ? (
                  <time dateTime={tarefa.prazo}>
                    {concluida ? (
                      <>
                        {prazo.frase}
                        <span className="sr-only">
                          , {formatarData(tarefa.prazo, true)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="sr-only">
                          Prazo: {formatarData(tarefa.prazo, true)}.{" "}
                        </span>
                        {prazo.frase}
                      </>
                    )}
                  </time>
                ) : (
                  <>Prazo: {tarefa.prazo}</>
                )}
              </p>
            </div>
            <div className="fol-fatos">
              <EtiquetasTarefa tarefa={tarefa} onMudarStatus={mudarStatus} />
              <p className="fol-quem">
                <Icon name="user" />
                <span>{tarefa.responsavel}</span>
              </p>
              <div className="e-read-project">
                <FolderIcon />
                {carregandoProjetos ? (
                  <Carregando compacto>Carregando projeto…</Carregando>
                ) : projetoInexistente ? (
                  <span>Projeto não encontrado</span>
                ) : (
                  <Link
                    to={`/projetos/${encodeURIComponent(tarefa.projetoId)}`}
                    onClick={(evento) => {
                      if (
                        !evento.ctrlKey &&
                        !evento.metaKey &&
                        !evento.shiftKey &&
                        !evento.altKey
                      ) {
                        evento.preventDefault();
                        navegar(
                          `/projetos/${encodeURIComponent(tarefa.projetoId)}`,
                        );
                      }
                    }}
                  >
                    {projeto?.nome ?? `Projeto ${tarefa.projetoId}`}
                  </Link>
                )}
                {erroProjetos !== undefined && (
                  <AvisoCompacto
                    texto="Nome do projeto indisponível."
                    tentando={tentandoProjetos}
                    onTentarDeNovo={tentarProjetos}
                  />
                )}
              </div>
            </div>
            {aviso && (
              <p className="sr-only" role="status">
                {aviso}
              </p>
            )}
            <p
              className={`e-read-description ${descricao ? "" : "is-empty"}`}
            >
              {descricao ? tarefa.descricao : "Sem descrição."}
            </p>
          </div>
        )}
      </div>
      {tarefa && (
        <footer className="e-form-footer">
          {exclusao.falha && (
            <p className="e-task-error" role="alert">
              Não foi possível excluir a tarefa. Tente de novo.
            </p>
          )}
          {exclusao.armado && (
            <span className="sr-only" role="status">
              Pressione de novo para excluir {tarefa.titulo}. Esta ação não
              pode ser desfeita.
            </span>
          )}
          <Button
            color={
              exclusao.armado ? "primary-destructive" : "tertiary-destructive"
            }
            size="sm"
            iconLeading={TrashIcon}
            className={`e-read-delete${exclusao.armado ? " e-excluir-armado" : ""}`}
            data-pronto={exclusao.pronto || undefined}
            onBlur={exclusao.desarmar}
            onKeyDown={(evento) => {
              if (evento.key === "Escape" && exclusao.armado)
                exclusao.desarmar();
              else evento.continuePropagation();
            }}
            onClick={() => void exclusao.tocar()}
            isLoading={exclusao.excluindo}
            showTextWhileLoading
          >
            {exclusao.excluindo
              ? "Excluindo…"
              : exclusao.armado
                ? "Confirmar exclusão"
                : "Excluir tarefa"}
          </Button>
          <Button
            color="secondary"
            size="sm"
            iconLeading={EditIcon}
            className="e-read-edit"
            onClick={() =>
              navegar(`/tarefas/${encodeURIComponent(tarefa.id)}/editar`)
            }
          >
            Editar tarefa
          </Button>
        </footer>
      )}
    </section>
  );
}
