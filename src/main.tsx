import { I18nProvider } from "react-aria-components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { Aparencia } from "./components/Aparencia";

const Router = import.meta.env.PROD && import.meta.env.VITE_GITHUB_PAGES === "true" ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Aparencia><I18nProvider locale="pt-BR">
    <Router>
      <App />
    </Router>
    </I18nProvider></Aparencia>
  </StrictMode>,
);
