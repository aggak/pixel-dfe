import type { CSSProperties } from "react";
import claro from "../assets/gatinho/lavando-claro.svg";
import escuro from "../assets/gatinho/lavando-escuro.svg";

export function GatinhoLavando() {
  return <span className="e-gato-lavando" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
