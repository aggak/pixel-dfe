import { Link, Route, Routes } from "react-router";
import { ListaTarefas } from "./pages/ListaTarefas";
import { DetalheTarefa } from "./pages/DetalheTarefa";
import { NovaTarefa } from "./pages/NovaTarefa";
import { Layout } from "./components/Layout";
import { ListaProjetos } from "./pages/ListaProjetos";
import { DetalheProjeto } from "./pages/DetalheProjeto";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ListaTarefas />} />
        <Route path="/projetos" element={<ListaProjetos />} />
        <Route path="/tarefas/nova" element={<NovaTarefa />} />
        <Route path="/tarefas/:id" element={<DetalheTarefa />} />
        <Route path="/projetos/:id" element={<DetalheProjeto />} />
        <Route path="*" element={
          <main className="pagina-tarefas">
            <h1>Página não encontrada</h1>
            <Link to="/">Voltar para tarefas</Link>
          </main>
        } />
      </Route>
    </Routes>
  );
}

export default App;
