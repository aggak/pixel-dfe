import type { CSSProperties } from "react";
import sprite from "../assets/gatinho/dormindo-escuro.svg";

export function GatinhoDormindo() {
  return <span className="e-gato-dormindo" style={{ "--e-gato": `url("${sprite}")` } as CSSProperties} aria-hidden="true" />;
}
