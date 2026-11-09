import type { CSSProperties } from "react";
import claro from "../assets/gatinho/costas-claro.svg";
import escuro from "../assets/gatinho/costas-escuro.svg";

export function GatinhoCostas() {
  return <span className="e-gato-costas" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
