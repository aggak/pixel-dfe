import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/olhando-escuro.svg";

export function GatinhoOlhando() {
  return <span className="e-gato-olhando" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
