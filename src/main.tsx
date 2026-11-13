import { I18nProvider } from "react-aria-components";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { FiltrosProvider } from "./components/FiltrosProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale="pt-BR">
    <BrowserRouter>
      <FiltrosProvider>
        <App />
      </FiltrosProvider>
    </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
