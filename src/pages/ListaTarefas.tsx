import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { FiltrosTarefas } from "../components/FiltrosTarefas";
import { useFiltros } from "../components/filtros-contexto";
import { AbasProjetos, Carregando, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { filtrarTarefas } from "../derivar";
import { Icon, PlusIcon } from "../design/icon";
import type { Tarefa } from "../tipos";

export function ListaTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const { filtros, limpar } = useFiltros();
  const { dados: projetos } = useConsulta(listarProjetos);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    listarTarefas(controller.signal).then(setTarefas).catch(() => { if (!controller.signal.aborted) setErro(true); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, []);
  // Derivado durante a renderização: a lista filtrada nunca é guardada como estado.
  const tarefasExibidas = useMemo(() => filtrarTarefas(tarefas, filtros), [tarefas, filtros]);
  return <><AbasProjetos /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>Tarefas</h1>
    <FiltrosTarefas />
    <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button>
  </header><div className="e-content">
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro && <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>As tarefas não carregaram</h2><p>Confira se a API está em execução.</p></div>}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao="Organize seu trabalho criando uma tarefa." destino="/tarefas/nova" acao="Criar tarefa" /> : tarefasExibidas.length === 0 ? <div className="e-search-empty"><p>Nenhuma tarefa encontrada.</p><Button color="link-color" size="sm" onClick={limpar}>Limpar busca e filtros</Button></div> : <section className="e-list" aria-label="Lista de tarefas">{tarefasExibidas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />)}</section>)}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasExibidas.length} {tarefasExibidas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
