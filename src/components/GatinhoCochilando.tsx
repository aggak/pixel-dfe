import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/cochilando-escuro.svg";

export function GatinhoCochilando() {
  return <span className="e-gato-cochilando" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
