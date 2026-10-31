import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { excluirTarefa, listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { FiltrosTarefas } from "../components/FiltrosTarefas";
import { useFiltros } from "../components/filtros-contexto";
import { AbasProjetos, AlternarVisao, Carregando, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { useMudarStatus } from "../hooks/useMudarStatus";
import { filtrarTarefas } from "../derivar";
import { Icon, PlusIcon } from "../design/icon";
import type { Tarefa } from "../tipos";

export function ListaTarefas() {
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
  // Derivado durante a renderização: a lista filtrada nunca é guardada como estado.
  const tarefasExibidas = useMemo(() => filtrarTarefas(tarefas, filtros), [tarefas, filtros]);
  return <><AbasProjetos /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>Tarefas</h1>
    <FiltrosTarefas />
    <AlternarVisao />
    <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button>
  </header>{aviso && <p className="sr-only" role="status">{aviso}</p>}<div className="e-content">
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro && <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>As tarefas não carregaram</h2><p>Confira se a API está em execução.</p></div>}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao="Organize seu trabalho criando uma tarefa." destino="/tarefas/nova" acao="Criar tarefa" /> : tarefasExibidas.length === 0 ? <div className="e-search-empty"><p>Nenhuma tarefa encontrada.</p><Button color="link-color" size="sm" onClick={limpar}>Limpar busca e filtros</Button></div> : <section className="e-list" aria-label="Lista de tarefas">{tarefasExibidas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} onMudarStatus={mudarStatus} onExcluir={excluir} nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />)}</section>)}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasExibidas.length} {tarefasExibidas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
