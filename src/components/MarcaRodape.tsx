import type { CSSProperties } from "react";
import rostoEscuro from "../assets/gatinho/rodape-rosto-escuro.svg";
import palavraEscuro from "../assets/gatinho/rodape-palavra-escuro.svg";

export function MarcaRodape() {
  const imagens = { "--e-rodape-rosto": `url("${rostoEscuro}")`, "--e-rodape-palavra": `url("${palavraEscuro}")` } as CSSProperties;
  return <strong className="e-footer-marca" style={imagens}><span className="e-footer-rosto" aria-hidden="true" /><span className="e-footer-palavra" aria-hidden="true" /><span className="e-footer-nome">Pixel</span></strong>;
}
