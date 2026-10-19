import { createContext, useContext } from "react";
import type { Location } from "react-router";

export function ehRotaFicha(caminho: string) {
  return /^\/tarefas\/(nova|[^/]+(?:\/editar)?)\/?$/.test(caminho) || /^\/projetos\/(novo|[^/]+\/editar)\/?$/.test(caminho);
}
export type EstadoFicha = { fundo?: Location; chaveConteudo?: string };
type Navegacao = { navegar: (destino: string, atualizar?: boolean) => void; fechar: () => void; setOcupada: (ocupada: boolean) => void };
export const ContextoFicha = createContext<Navegacao | null>(null);
export function useFicha() {
  const contexto = useContext(ContextoFicha);
  if (!contexto) throw new Error("A página deve estar dentro de uma ficha.");
  return contexto;
}
