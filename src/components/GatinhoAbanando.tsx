import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/abanando-escuro.svg";

export function GatinhoAbanando() {
  return <span className="e-gato-abanando" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
