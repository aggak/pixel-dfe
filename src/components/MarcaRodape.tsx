import type { CSSProperties } from "react";
import claro from "../assets/gatinho/rodape-marca-claro.svg";
import escuro from "../assets/gatinho/rodape-marca-escuro.svg";

export function MarcaRodape() {
  return <strong className="e-footer-marca" style={{ "--e-rodape-marca-claro": `url("${claro}")`, "--e-rodape-marca-escuro": `url("${escuro}")` } as CSSProperties}><span className="e-footer-palavra" aria-hidden="true" /><span className="e-footer-nome">Pixel</span></strong>;
}
