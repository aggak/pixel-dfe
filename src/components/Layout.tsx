import { NavLink, Outlet } from "react-router";

export function Layout() {
  return (
    <>
      <header className="cabecalho-app">
        <p className="cabecalho-app__marca">Pixel</p>
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>Tarefas</NavLink>
          <NavLink to="/projetos">Projetos</NavLink>
        </nav>
      </header>
      <Outlet />
    </>
  );
}
