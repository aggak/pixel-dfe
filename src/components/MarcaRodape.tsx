import type { CSSProperties } from "react";
import rostoClaro from "../assets/gatinho/rodape-rosto-claro.svg";
import rostoEscuro from "../assets/gatinho/rodape-rosto-escuro.svg";
import palavraClaro from "../assets/gatinho/rodape-palavra-claro.svg";
import palavraEscuro from "../assets/gatinho/rodape-palavra-escuro.svg";

export function MarcaRodape() {
  const imagens = { "--e-rodape-rosto-claro": `url("${rostoClaro}")`, "--e-rodape-rosto-escuro": `url("${rostoEscuro}")`, "--e-rodape-palavra-claro": `url("${palavraClaro}")`, "--e-rodape-palavra-escuro": `url("${palavraEscuro}")` } as CSSProperties;
  return <strong className="e-footer-marca" style={imagens}><span className="e-footer-rosto" aria-hidden="true" /><span className="e-footer-palavra" aria-hidden="true" /><span className="e-footer-nome">Pixel</span></strong>;
}
