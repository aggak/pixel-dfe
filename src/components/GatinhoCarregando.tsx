import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/carregando-escuro.svg";

export function GatinhoCarregando() {
  return <span className="e-gato-carregando" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
