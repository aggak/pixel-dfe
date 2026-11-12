import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/costas-escuro.svg";

export function GatinhoCostas() {
  return <span className="e-gato-costas" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
