import type { CSSProperties } from "react";
import claro from "../assets/gatinho/cochilando-claro.svg";
import escuro from "../assets/gatinho/cochilando-escuro.svg";

export function GatinhoCochilando() {
  return <span className="e-gato-cochilando" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
