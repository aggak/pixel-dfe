import { useEffect, type ReactNode } from "react";

export function Aparencia({ children }: { children: ReactNode }) {
  useEffect(() => {
    const preferencia = window.matchMedia("(prefers-color-scheme: dark)");
    const aplicar = () => {
      document.documentElement.classList.toggle("dark", preferencia.matches);
      document.documentElement.classList.toggle("dark-mode", preferencia.matches);
    };
    aplicar();
    preferencia.addEventListener("change", aplicar);
    return () => preferencia.removeEventListener("change", aplicar);
  }, []);
  return children;
}
