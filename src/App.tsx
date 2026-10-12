import { Link, Route, Routes } from "react-router";
import { ListaTarefas } from "./pages/ListaTarefas";
import { DetalheTarefa } from "./pages/DetalheTarefa";
import { Layout } from "./components/Layout";
import { ListaProjetos } from "./pages/ListaProjetos";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ListaTarefas />} />
        <Route path="/projetos" element={<ListaProjetos />} />
        <Route path="/tarefas/:id" element={<DetalheTarefa />} />
        <Route path="/projetos/:id" element={<h1>Detalhes do projeto</h1>} />
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
