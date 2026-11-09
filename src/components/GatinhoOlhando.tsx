import type { CSSProperties } from "react";
import claro from "../assets/gatinho/olhando-claro.svg";
import escuro from "../assets/gatinho/olhando-escuro.svg";

export function GatinhoOlhando() {
  return <span className="e-gato-olhando" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
