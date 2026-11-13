import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { excluirTarefaSeExistir, listarTarefas, listarProjetos } from "../api";
import { CartaoTarefa } from "./CartaoTarefa";
import { AcaoCabecalho } from "./Cabecalho";
import { FiltrosTarefas } from "./FiltrosTarefas";
import { useFiltros } from "./filtros-contexto";
import { AbasProjetos, AlternarVisao, AnuncioResultados, AvisoTarefaEscondida, Carregando, ErroCarregamento, EstadoVazio } from "./Layout";
import { useConsulta } from "../hooks/useConsulta";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { useMudarStatus } from "../hooks/useMudarStatus";
import { useRetornoFoco } from "../hooks/useRetornoFoco";
import { filtrarTarefas } from "../derivar";
import { PlusIcon } from "../design/icon";
import type { Projeto, Tarefa } from "../tipos";

let ultimasTarefas: Tarefa[] | undefined;
let ultimosProjetos: Projeto[] | undefined;

type Cartao = (tarefa: Tarefa, variante?: "lista" | "quadro") => ReactNode;

export function VisaoTarefas({ titulo, classeConteudo = "e-content", children }: { titulo: string; classeConteudo?: string; children: (tarefas: Tarefa[], cartao: Cartao) => ReactNode }) {
  useTituloPagina(titulo);
  const consultaTarefas = useConsulta(listarTarefas, ultimasTarefas);
  const { dados, erro, carregando, tentando } = consultaTarefas;
  const [tarefas, setTarefas] = useState<Tarefa[]>(dados ?? []);
  const [origem, setOrigem] = useState(dados);
  if (dados !== origem) {
    setOrigem(dados);
    setTarefas(dados ?? []);
  }
  const { filtros, limpar } = useFiltros();
  const consultaProjetos = useConsulta(listarProjetos, ultimosProjetos);
  const projetos = consultaProjetos.dados;
  const { mudarStatus, aviso } = useMudarStatus(tarefas, setTarefas);
  const location = useLocation();
  const navigate = useNavigate();
  const excluir = async (tarefa: Tarefa) => {
    await excluirTarefaSeExistir(tarefa.id);
    setTarefas((atuais) => atuais.filter((atual) => atual.id !== tarefa.id));
  };
  useEffect(() => { if (dados !== undefined) ultimasTarefas = tarefas; }, [dados, tarefas]);
  useEffect(() => { if (projetos !== undefined) ultimosProjetos = projetos; }, [projetos]);
  const tentarDeNovo = () => {
    consultaTarefas.tentarDeNovo();
    if (consultaProjetos.erro !== undefined) consultaProjetos.tentarDeNovo();
  };
  // Derivado durante a renderização: a lista filtrada nunca é guardada como estado.
  const tarefasExibidas = useMemo(() => filtrarTarefas(tarefas, filtros), [tarefas, filtros]);
  useRetornoFoco(!consultaTarefas.revalidando && !erro && !consultaProjetos.revalidando);
  const cartao: Cartao = (tarefa, variante) => <CartaoTarefa key={tarefa.id} tarefa={tarefa} onMudarStatus={mudarStatus} onExcluir={excluir} variante={variante} nomeProjeto={projetos?.find((projeto) => projeto.id === tarefa.projetoId)?.nome} />;
  return <><AbasProjetos projetos={consultaProjetos} mostrarErro={!erro} /><main className="e-sheet"><header className="e-tools e-task-tools">
    <h1 className="e-task-page-title" tabIndex={-1}>{titulo}</h1>
    <FiltrosTarefas />
    <AlternarVisao />
    <AcaoCabecalho><Button className="e-top-acao-botao" color="primary" size="sm" iconLeading={PlusIcon} aria-label="Nova tarefa" data-action="new-task" onClick={() => navigate("/tarefas/nova", { state: { fundo: location } })}>Nova tarefa</Button></AcaoCabecalho>
  </header>{aviso && <p className="sr-only" role="status">{aviso}</p>}<AnuncioResultados total={tarefasExibidas.length} filtros={filtros} /><div className={classeConteudo}><AvisoTarefaEscondida tarefas={tarefas} exibidas={tarefasExibidas} onLimpar={limpar} />
    {carregando && <Carregando>Carregando tarefas…</Carregando>}
    {erro !== undefined && <ErroCarregamento titulo="Não foi possível carregar as tarefas" erro={erro} onTentarDeNovo={tentarDeNovo} tentando={tentando} />}
    {!carregando && !erro && (tarefas.length === 0 ? <EstadoVazio icone="clipboard-list" titulo="Nenhuma tarefa por aqui" destino="/tarefas/nova" acao="Criar tarefa" /> : tarefasExibidas.length === 0 ? <EstadoVazio icone="search" titulo="Nenhuma tarefa encontrada" acao="Limpar busca e filtros" onAcao={limpar} /> : children(tarefasExibidas, cartao))}
  </div>{!carregando && !erro && <footer className="e-sheet-footer">{tarefasExibidas.length} {tarefasExibidas.length === 1 ? "tarefa" : "tarefas"}</footer>}</main></>;
}
