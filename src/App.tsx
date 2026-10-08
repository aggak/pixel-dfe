import { Link, Route, Routes } from "react-router";
import "./App.css";

function App() {
  return (
    <>
      <nav>
        <Link to="/">Tarefas</Link>
        {" | "}
        <Link to="/projetos">Projetos</Link>
        {" | "}
        <Link to="/tarefas/1">Detalhes da tarefa</Link>
        {" | "}
        <Link to="/projetos/1">Detalhes do projeto</Link>
      </nav>
      <Routes>
        <Route path="/" element={<h1>Tarefas</h1>} />
        <Route path="/projetos" element={<h1>Projetos</h1>} />
        <Route path="/tarefas/:id" element={<h1>Detalhes da tarefa</h1>} />
        <Route path="/projetos/:id" element={<h1>Detalhes do projeto</h1>} />
        <Route path="*" element={<h1>Página não encontrada</h1>} />
      </Routes>
    </>
  );
}

export default App;
