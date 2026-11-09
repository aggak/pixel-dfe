import type { CSSProperties } from "react";
import claro from "../assets/gatinho/carregando-claro.svg";
import escuro from "../assets/gatinho/carregando-escuro.svg";

export function GatinhoCarregando() {
  return <span className="e-gato-carregando" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
