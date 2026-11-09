import type { CSSProperties } from "react";
import claro from "../assets/gatinho/abanando-claro.svg";
import escuro from "../assets/gatinho/abanando-escuro.svg";

export function GatinhoAbanando() {
  return <span className="e-gato-abanando" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
