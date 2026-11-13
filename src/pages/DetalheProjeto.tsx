import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { buscarProjeto, excluirTarefaSeExistir, listarProjetos, listarTarefasDoProjeto, ErroApi } from "../api";
import { CartaoTarefa } from "../components/CartaoTarefa";
import { AcaoCabecalho } from "../components/Cabecalho";
import { GatinhoCochilando } from "../components/GatinhoCochilando";
import { AbasProjetos, Carregando, ErroCarregamento, EstadoVazio } from "../components/Layout";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { useMudarStatus } from "../hooks/useMudarStatus";
import { useRetornoFoco } from "../hooks/useRetornoFoco";
import { EditIcon, FolderIcon, Icon, PlusIcon } from "../design/icon";
import { formatarData } from "../design/formatos";
import type { Tarefa } from "../tipos";

export function DetalheProjeto() {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [detalhes, setDetalhes] = useState((location.state as { detalhes?: boolean } | null)?.detalhes === true);
  const consultar = useCallback(async (signal: AbortSignal) => {
    const [projeto, tarefas] = await Promise.all([buscarProjeto(id, signal), listarTarefasDoProjeto(id, signal)]);
    return { projeto, tarefas };
  }, [id]);
  const { dados, erro, carregando, tentando, tentarDeNovo } = useConsulta(consultar);
  useTituloPagina(erro instanceof ErroApi && erro.status === 404 ? "Projeto não encontrado" : dados?.projeto.nome ?? "Projeto");
  const consultaProjetos = useConsulta(listarProjetos);
  const tentarTudo = () => {
    tentarDeNovo();
    if (consultaProjetos.erro !== undefined) consultaProjetos.tentarDeNovo();
  };
  const [tarefas, setTarefas] = useState<Tarefa[]>(dados?.tarefas ?? []);
  const [origem, setOrigem] = useState(dados);
  if (dados !== origem) {
    setOrigem(dados);
    setTarefas(dados?.tarefas ?? []);
  }
  const { mudarStatus, aviso } = useMudarStatus(tarefas, setTarefas);
  useRetornoFoco(dados !== undefined);
  const excluir = async (tarefa: Tarefa) => {
    await excluirTarefaSeExistir(tarefa.id);
    setTarefas((atuais) => atuais.filter((atual) => atual.id !== tarefa.id));
  };
  const novaTarefa = `/tarefas/nova?projetoId=${encodeURIComponent(id)}`;
  return <><AbasProjetos atual={id} projetos={consultaProjetos} mostrarErro={erro === undefined} /><main className="e-sheet"><header className="e-tools"><h1 tabIndex={-1}>{dados?.projeto.nome ?? "Projeto"}</h1><AcaoCabecalho>{dados && <Button className="e-top-acao-botao" color="primary" size="sm" iconLeading={PlusIcon} aria-label="Nova tarefa" data-action="new-task" onClick={() => navigate(novaTarefa, { state: { fundo: location } })}>Nova tarefa</Button>}</AcaoCabecalho></header>
    {dados && <div className={`e-project-details ${detalhes ? "is-open" : ""}`}><button className="e-details-trigger" aria-expanded={detalhes} aria-controls="project-details" onClick={() => setDetalhes(!detalhes)}><FolderIcon /><span>Detalhes do projeto</span><Icon name={detalhes ? "angle-small-up" : "angle-small-down"} /></button>{detalhes && <div id="project-details" className="e-details-content"><h2 className="e-project-name">{dados.projeto.nome}</h2><p>{dados.projeto.descricao}</p><dl><div><dt>Disciplina</dt><dd>{dados.projeto.disciplina}</dd></div><div><dt>Criado em</dt><dd><time dateTime={dados.projeto.criadoEm}>{formatarData(dados.projeto.criadoEm, true)}</time></dd></div></dl><Button color="link-color" size="sm" className="e-edit-project-details" iconLeading={EditIcon} onClick={() => navigate(`/projetos/${encodeURIComponent(id)}/editar`, { state: { fundo: location, detalhes: true } })}>Editar projeto</Button></div>}</div>}
    {aviso && <p className="sr-only" role="status">{aviso}</p>}<div className="e-content">{carregando && <Carregando>Carregando projeto…</Carregando>}{erro instanceof ErroApi && erro.status === 404 ? <div className="e-load-error" role="alert"><GatinhoCochilando /><h2>Projeto não encontrado</h2><p>Este projeto não está disponível.</p><Link to="/projetos">Voltar para projetos</Link></div> : erro !== undefined && <ErroCarregamento titulo="Não foi possível carregar o projeto" erro={erro} onTentarDeNovo={tentarTudo} tentando={tentando} />}{dados && <section aria-label="Tarefas do projeto">{tarefas.length === 0 ? <EstadoVazio icone="clipboard-list" titulo="Este projeto ainda não tem tarefas" destino={novaTarefa} acao="Criar tarefa" /> : <div className="e-list">{tarefas.map((tarefa) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} onMudarStatus={mudarStatus} onExcluir={excluir} />)}</div>}</section>}</div>
    {dados && <footer className="e-sheet-footer">{tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}</footer>}
  </main></>;
}
