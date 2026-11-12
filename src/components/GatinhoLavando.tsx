import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/lavando-escuro.svg";

export function GatinhoLavando() {
  return <span className="e-gato-lavando" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
