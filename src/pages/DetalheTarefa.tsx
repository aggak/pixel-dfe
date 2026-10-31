import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { buscarTarefa, listarProjetos, ErroApi } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import { useFicha } from "../components/ficha-contexto";
import { Carregando } from "../components/Layout";
import { Icon, FolderIcon, EditIcon } from "../design/icon";
import { formatarData, prioridadeTexto, statusTexto } from "../design/formatos";

export function DetalheTarefa() {
  const { id = "" } = useParams();
  const consultar = useCallback((signal: AbortSignal) => buscarTarefa(id, signal), [id]);
  const { dados: tarefa, erro, carregando, tentarDeNovo } = useConsulta(consultar);
  const { dados: projetos, erro: erroProjetos, carregando: carregandoProjetos, tentarDeNovo: tentarProjetos } = useConsulta(listarProjetos);
  const { navegar } = useFicha();
  return <section className="e-read-task" aria-label="Dados da tarefa">
    <div className="e-panel-scroll">
      {carregando && <p className="e-ficha-state" role="status">Carregando tarefa…</p>}
      {erro !== undefined && <p className="e-ficha-state e-form-error" role="alert">{erro instanceof ErroApi && erro.status === 404 ? "Tarefa não encontrada." : "Não foi possível carregar a tarefa. Confira se a API está em execução."}</p>}{erro !== undefined && !(erro instanceof ErroApi && erro.status === 404) && <Button color="secondary" size="sm" className="e-ficha-retry" onClick={() => { tentarDeNovo(); if (erroProjetos !== undefined) tentarProjetos(); }}>Tentar de novo</Button>}
      {tarefa && <div className="e-read-body"><h2 className="e-read-title">{tarefa.titulo}</h2><div className="e-read-project"><FolderIcon />{carregandoProjetos ? <Carregando compacto>Carregando projeto…</Carregando> : <Link to={`/projetos/${encodeURIComponent(tarefa.projetoId)}`} onClick={(evento) => { if (!evento.ctrlKey && !evento.metaKey && !evento.shiftKey && !evento.altKey) { evento.preventDefault(); navegar(`/projetos/${encodeURIComponent(tarefa.projetoId)}`); } }}>{projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome ?? `Projeto ${tarefa.projetoId}`}</Link>}</div>
        <div className="e-read-tags"><BadgeWithDot type="pill-color" size="sm" color={tarefa.status === "concluida" ? "success" : tarefa.status === "a-fazer" ? "gray" : "brand"} className={`e-status e-status-${tarefa.status}`}>{statusTexto[tarefa.status]}</BadgeWithDot><Badge type="modern" size="sm" color="gray" className={`e-priority e-priority-${tarefa.prioridade}`}><Icon name={tarefa.prioridade === "alta" ? "angle-double-small-up" : tarefa.prioridade === "baixa" ? "arrow-small-down" : "minus-small"} />{prioridadeTexto[tarefa.prioridade]}</Badge></div>
        <div className="e-read-meta"><p><Icon name="user" /><span>{tarefa.responsavel}</span></p><p><Icon name="calendar" /><time dateTime={tarefa.prazo}>{formatarData(tarefa.prazo, true)}</time></p></div><p className={`e-read-description ${tarefa.descricao.trim() ? "" : "is-empty"}`}>{tarefa.descricao.trim() ? tarefa.descricao : "Sem descrição."}</p><dl className="e-read-identifiers"><div><dt>Identificador</dt><dd>{tarefa.id}</dd></div><div><dt>Projeto</dt><dd>{tarefa.projetoId}</dd></div></dl>
      </div>}
    </div>
    {tarefa && <footer className="e-form-footer"><Button color="secondary" size="sm" iconLeading={EditIcon} className="e-read-edit" onClick={() => navegar(`/tarefas/${encodeURIComponent(tarefa.id)}/editar`)}>Editar tarefa</Button></footer>}
  </section>;
}
