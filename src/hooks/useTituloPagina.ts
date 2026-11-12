import { createContext, useContext, useEffect } from "react";

export const ContextoPaginaAtiva = createContext(true);

export function useTituloPagina(titulo: string) {
  const ativa = useContext(ContextoPaginaAtiva);
  useEffect(() => {
    if (ativa) document.title = `${titulo} · Pixel`;
  }, [titulo, ativa]);
}

export function TituloPagina({ titulo }: { titulo: string }) {
  useTituloPagina(titulo);
  return null;
}
