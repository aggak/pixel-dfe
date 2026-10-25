import { lazy, Suspense } from "react";
import { Link, Route, Routes, useLocation, type Location } from "react-router";
import { ListaTarefas } from "./pages/ListaTarefas";
import { QuadroTarefas } from "./pages/QuadroTarefas";
import { DetalheTarefa } from "./pages/DetalheTarefa";
import { Layout } from "./components/Layout";
import { Ficha } from "./components/Ficha";
import { ehRotaFicha, type EstadoFicha } from "./components/ficha-contexto";
import { ListaProjetos } from "./pages/ListaProjetos";
import { DetalheProjeto } from "./pages/DetalheProjeto";
import "./App.css";

const NovaTarefa = lazy(() => import("./pages/NovaTarefa").then((pagina) => ({ default: pagina.NovaTarefa })));
const EditarTarefa = lazy(() => import("./pages/EditarTarefa").then((pagina) => ({ default: pagina.EditarTarefa })));
const NovoProjeto = lazy(() => import("./pages/NovoProjeto").then((pagina) => ({ default: pagina.NovoProjeto })));
const EditarProjeto = lazy(() => import("./pages/EditarProjeto").then((pagina) => ({ default: pagina.EditarProjeto })));

function App() {
  const location = useLocation();
  const caminho = location.pathname.replace(/\/+$/, "") || "/";
  const ficha = ehRotaFicha(caminho);
  const estado = location.state as EstadoFicha | null;
  const projetoNovo = caminho === "/projetos/novo";
  const tarefaNova = caminho === "/tarefas/nova";
  const editando = caminho.endsWith("/editar");
  const projeto = caminho.startsWith("/projetos/");
  const projetoOrigem = new URLSearchParams(location.search).get("projetoId");
  const fallback = projetoNovo ? "/projetos" : projeto ? caminho.replace(/\/editar$/, "") : tarefaNova && projetoOrigem ? `/projetos/${encodeURIComponent(projetoOrigem)}` : "/";
  const candidato = estado?.fundo;
  const fundo: Location = ficha && candidato && typeof candidato.pathname === "string" && !ehRotaFicha(candidato.pathname) && (candidato.pathname === "/" || candidato.pathname === "/quadro" || candidato.pathname === "/projetos" || /^\/projetos\/[^/]+$/.test(candidato.pathname))
    ? candidato : ficha ? { pathname: fallback, search: "", hash: "", state: null, key: `fundo:${fallback}` } : location;
  const titulo = projetoNovo ? "Novo projeto" : tarefaNova ? "Nova tarefa" : editando ? projeto ? "Editar projeto" : "Editar tarefa" : "Detalhes da tarefa";
  const destinoFechar = editando ? caminho.replace(/\/editar$/, "") : tarefaNova ? fallback : projetoNovo ? "/projetos" : fundo.pathname + fundo.search;
  return <>
    <Routes location={fundo} key={(fundo.state as EstadoFicha | null)?.chaveConteudo ?? fundo.key}>
      <Route element={<Layout />}>
        <Route path="/" element={<ListaTarefas />} />
        <Route path="/quadro" element={<QuadroTarefas />} />
        <Route path="/projetos" element={<ListaProjetos />} />
        <Route path="/projetos/:id" element={<DetalheProjeto />} />
        <Route path="*" element={<main className="e-sheet e-not-found"><h1 tabIndex={-1}>Página não encontrada</h1><Link to="/">Voltar para tarefas</Link></main>} />
      </Route>
    </Routes>
    {ficha && <Ficha titulo={titulo} icone={projeto ? "folder" : editando ? "pencil" : tarefaNova ? "add-document" : "document"} destinoFechar={destinoFechar} fundo={fundo} origemInterna={candidato === fundo}>
      <Suspense fallback={<p className="e-ficha-state" role="status">Carregando formulário…</p>}>
      <Routes location={location}>
        <Route path="/tarefas/nova" element={<NovaTarefa />} />
        <Route path="/tarefas/:id/editar" element={<EditarTarefa />} />
        <Route path="/tarefas/:id" element={<DetalheTarefa />} />
        <Route path="/projetos/novo" element={<NovoProjeto />} />
        <Route path="/projetos/:id/editar" element={<EditarProjeto />} />
      </Routes>
      </Suspense>
    </Ficha>}
  </>;
}
export default App;
