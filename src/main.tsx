import { I18nProvider } from "react-aria-components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { Aparencia } from "./components/Aparencia";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Aparencia><I18nProvider locale="pt-BR">
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </I18nProvider></Aparencia>
  </StrictMode>,
);
