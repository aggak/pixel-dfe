import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { excluirTarefa, listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { FiltrosTarefas } from "../components/FiltrosTarefas";
import { useFiltros } from "../components/filtros-contexto";
import { AbasProjetos, AlternarVisao, Carregando, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { useMudarStatus } from "../hooks/useMudarStatus";
import { agruparPorStatus, filtrarTarefas } from "../derivar";
import { statusTexto } from "../design/formatos";
import { Icon, PlusIcon } from "../design/icon";
import type { Status, Tarefa } from "../tipos";

const iconesStatus: Record<Status, string> = { "a-fazer": "circle", "em-andamento": "play", "em-revisao": "eye", concluida: "check" };

export function QuadroTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const { filtros, limpar } = useFiltros();
  const { dados: projetos } = useConsulta(listarProjetos);
  const { mudarStatus, aviso } = useMudarStatus(tarefas, setTarefas);
  const location = useLocation();
  const navigate = useNavigate();
  const excluir = async (tarefa: Tarefa) => {
    await excluirTarefa(tarefa.id);
    setTarefas((atuais) => atuais.filter((atual) => atual.id !== tarefa.id));
  };
  useEffect(() => {
    const controller = new AbortController();
    listarTarefas(controller.signal).then(setTarefas).catch(() => { if (!controller.signal.aborted) setErro(true); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, []);
  // Mesma derivação da lista, com um passo a mais: o agrupamento por status.
  const tarefasFiltradas = useMemo(() => filtrarTarefas(tarefas, filtros), [tarefas, filtros]);
  const colunas = useMemo(() => agruparPorStatus(tarefasFiltradas), [tarefasFiltradas]);
  return <><AbasProjetos /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>Quadro</h1>
    <FiltrosTarefas />
    <AlternarVisao />
    <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button>
  </header>{aviso && <p className="sr-only" role="status">{aviso}</p>}<div className="e-content e-board-content">
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro && <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>As tarefas não carregaram</h2><p>Confira se a API está em execução.</p></div>}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao="Organize seu trabalho criando uma tarefa." destino="/tarefas/nova" acao="Criar tarefa" /> : <>
      {tarefasFiltradas.length === 0 && <div className="e-search-empty e-board-empty"><p>Nenhuma tarefa encontrada.</p><Button color="link-color" size="sm" onClick={limpar}>Limpar busca e filtros</Button></div>}
      <section className="e-board" aria-label="Quadro de tarefas por status">{colunas.map((coluna) => <section key={coluna.status} className="e-column" aria-label={statusTexto[coluna.status]} data-status-column={coluna.status}>
        <h2><span className="e-column-name"><Icon name={iconesStatus[coluna.status]} /><span>{statusTexto[coluna.status]}</span></span><Badge type="modern" color="gray" size="sm">{coluna.tarefas.length}</Badge></h2>
        {coluna.tarefas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} onMudarStatus={mudarStatus} onExcluir={excluir} variante="quadro" nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />)}
        {coluna.tarefas.length === 0 && <p className="e-column-empty">Nenhuma tarefa</p>}
      </section>)}</section>
    </>)}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasFiltradas.length} {tarefasFiltradas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
