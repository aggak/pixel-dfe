import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { buscarProjeto, excluirTarefa, listarTarefasDoProjeto, ErroApi } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { AbasProjetos, Carregando, ErroCarregamento, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { EditIcon, FolderIcon, Icon, PlusIcon } from "../design/icon";
import { formatarData } from "../design/formatos";
import type { Tarefa } from "../tipos";

export function DetalheProjeto() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [detalhes, setDetalhes] = useState(false);
  const [excluidas, setExcluidas] = useState<string[]>([]);
  const consultar = useCallback(async (signal: AbortSignal) => {
    const [projeto, tarefas] = await Promise.all([buscarProjeto(id, signal), listarTarefasDoProjeto(id, signal)]);
    return { projeto, tarefas };
  }, [id]);
  const { dados, erro, carregando, tentativa, tentarDeNovo } = useConsulta(consultar);
  const tarefas = dados?.tarefas.filter((tarefa) => !excluidas.includes(tarefa.id)) ?? [];
  const excluir = async (tarefa: Tarefa) => {
    await excluirTarefa(tarefa.id);
    setExcluidas((atuais) => [...atuais, tarefa.id]);
  };
  const novaTarefa = `/tarefas/nova?projetoId=${encodeURIComponent(id)}`;
  return <><AbasProjetos key={tentativa} atual={id} /><main className="e-sheet"><header className="e-tools"><h1 tabIndex={-1}>{dados?.projeto.nome ?? "Projeto"}</h1><div className="e-toolbar-right">{dados && <Button color="primary" size="sm" iconLeading={PlusIcon} data-action="new-task" onClick={() => navigate(novaTarefa, { state: { fundo: location } })}>Nova tarefa</Button>}</div></header>
    {dados && <div className={`e-project-details ${detalhes ? "is-open" : ""}`}><button className="e-details-trigger" aria-expanded={detalhes} aria-controls="project-details" onClick={() => setDetalhes(!detalhes)}><FolderIcon /><span>Detalhes do projeto</span><Icon name={detalhes ? "angle-small-up" : "angle-small-down"} /></button>{detalhes && <div id="project-details" className="e-details-content"><h2 className="e-project-name">{dados.projeto.nome}</h2><p>{dados.projeto.descricao}</p><dl><div><dt>Identificador</dt><dd>{dados.projeto.id}</dd></div><div><dt>Disciplina</dt><dd>{dados.projeto.disciplina}</dd></div><div><dt>Criado em</dt><dd><time dateTime={dados.projeto.criadoEm}>{formatarData(dados.projeto.criadoEm, true)}</time></dd></div></dl><Button color="link-color" size="sm" className="e-edit-project-details" iconLeading={EditIcon} onClick={() => navigate(`/projetos/${encodeURIComponent(id)}/editar`, { state: { fundo: location } })}>Editar projeto</Button></div>}</div>}
    <div className="e-content">{carregando && <Carregando>Carregando projeto…</Carregando>}{erro instanceof ErroApi && erro.status === 404 ? <div className="e-load-error" role="alert"><Icon name="exclamation" /><h2>Projeto não encontrado</h2><p>Este projeto não está disponível.</p><Link to="/projetos">Voltar para projetos</Link></div> : erro !== undefined && <ErroCarregamento titulo="O projeto não carregou" onTentarDeNovo={tentarDeNovo} />}{dados && <section aria-label="Tarefas do projeto">{tarefas.length === 0 ? <EstadoVazio titulo="Espaço para o próximo passo" descricao={`Crie a primeira tarefa de ${dados.projeto.nome}.`} destino={novaTarefa} acao="Criar tarefa" /> : <div className="e-list">{tarefas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} onExcluir={excluir} />)}</div>}</section>}</div>
    {dados && <footer className="e-sheet-footer">{tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}</footer>}
  </main></>;
}
