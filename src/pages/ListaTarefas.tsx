import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { AbasProjetos, Carregando, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { Icon, PlusIcon, SearchIcon } from "../design/icon";
import { prioridadeTexto, statusTexto } from "../design/formatos";
import type { Prioridade, Status, Tarefa } from "../tipos";

const opcoesStatus: { id: Status | "todos"; label: string }[] = [
  { id: "todos", label: "Todos os status" },
  ...Object.entries(statusTexto).map(([id, label]) => ({ id: id as Status, label })),
];
const opcoesPrioridade: { id: Prioridade | "todas"; label: string }[] = [
  { id: "todas", label: "Todas as prioridades" },
  ...Object.entries(prioridadeTexto).map(([id, label]) => ({ id: id as Prioridade, label })),
];

export function ListaTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<Status | "todos">("todos");
  const [prioridade, setPrioridade] = useState<Prioridade | "todas">("todas");
  const { dados: projetos } = useConsulta(listarProjetos);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    listarTarefas(controller.signal).then(setTarefas).catch(() => { if (!controller.signal.aborted) setErro(true); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, []);
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const tarefasExibidas = tarefas.filter((tarefa) =>
    tarefa.titulo.toLocaleLowerCase("pt-BR").includes(termo) &&
    (status === "todos" || tarefa.status === status) &&
    (prioridade === "todas" || tarefa.prioridade === prioridade),
  );
  return <><AbasProjetos /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>Tarefas</h1>
    <Input className="e-task-search" size="sm" type="search" label="Buscar por título" placeholder="Buscar tarefas" icon={SearchIcon} value={busca} onChange={setBusca} />
    <div className="e-task-filters">
      <Select className="e-task-filter" label="Status" size="sm" items={opcoesStatus} selectedKey={status} onSelectionChange={(chave) => setStatus((chave ?? "todos") as Status | "todos")}>{(item) => <Select.Item id={item.id} textValue={item.label}>{item.label}</Select.Item>}</Select>
      <Select className="e-task-filter" label="Prioridade" size="sm" items={opcoesPrioridade} selectedKey={prioridade} onSelectionChange={(chave) => setPrioridade((chave ?? "todas") as Prioridade | "todas")}>{(item) => <Select.Item id={item.id} textValue={item.label}>{item.label}</Select.Item>}</Select>
    </div>
    <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button>
  </header><div className="e-content">
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro && <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>As tarefas não carregaram</h2><p>Confira se a API está em execução.</p></div>}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao="Organize seu trabalho criando uma tarefa." destino="/tarefas/nova" acao="Criar tarefa" /> : tarefasExibidas.length === 0 ? <p className="e-search-empty">Nenhuma tarefa encontrada.</p> : <section className="e-list" aria-label="Lista de tarefas">{tarefasExibidas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />)}</section>)}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasExibidas.length} {tarefasExibidas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
