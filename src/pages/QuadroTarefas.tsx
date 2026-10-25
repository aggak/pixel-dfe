import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { ControlesFiltro } from "../components/ControlesFiltro";
import { useFiltros } from "../contexts/filtros-contexto";
import { agruparPorStatus, filtrarTarefas } from "../derivar";
import { AbasProjetos, Carregando, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { Icon, PlusIcon } from "../design/icon";
import { statusTexto } from "../design/formatos";
import type { Tarefa } from "../tipos";

export function QuadroTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const { filtros } = useFiltros();
  const { dados: projetos } = useConsulta(listarProjetos);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    listarTarefas(controller.signal).then(setTarefas).catch(() => { if (!controller.signal.aborted) setErro(true); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, []);
  const tarefasExibidas = filtrarTarefas(tarefas, filtros);
  return <><AbasProjetos /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>Quadro de tarefas</h1>
    <ControlesFiltro />
    <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button>
  </header><div className="e-content">
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro && <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>As tarefas não carregaram</h2><p>Confira se a API está em execução.</p></div>}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao="Organize seu trabalho criando uma tarefa." destino="/tarefas/nova" acao="Criar tarefa" /> : tarefasExibidas.length === 0 ? <p className="e-search-empty">Nenhuma tarefa encontrada.</p> : <section className="e-board" aria-label="Quadro de tarefas">{agruparPorStatus(tarefasExibidas).map(({ status, tarefas: daColuna }) => <section key={status} className="e-board-column" aria-labelledby={`coluna-${status}`} data-status={status}>
      <header className="e-board-heading"><h2 id={`coluna-${status}`}>{statusTexto[status]}</h2><span className="e-board-count" aria-label={`${daColuna.length} ${daColuna.length === 1 ? "tarefa" : "tarefas"}`}>{daColuna.length}</span></header>
      <div className="e-board-cards">{daColuna.length === 0 ? <p className="e-board-empty">Nenhuma tarefa</p> : daColuna.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} variante="coluna" nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />)}</div>
    </section>)}</section>)}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasExibidas.length} {tarefasExibidas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
