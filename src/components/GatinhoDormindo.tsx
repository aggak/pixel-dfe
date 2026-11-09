import type { CSSProperties } from "react";
import claro from "../assets/gatinho/dormindo-claro.svg";
import escuro from "../assets/gatinho/dormindo-escuro.svg";

export function GatinhoDormindo() {
  return <span className="e-gato-dormindo" style={{ "--e-gato-claro": `url("${claro}")`, "--e-gato-escuro": `url("${escuro}")` } as CSSProperties} aria-hidden="true" />;
}
