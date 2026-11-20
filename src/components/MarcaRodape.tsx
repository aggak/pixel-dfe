import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function MarcaRodape() {
  const rosto = useSprite("rodape-rosto");
  const palavra = useSprite("rodape-palavra");
  const imagens = {
    "--e-rodape-rosto": rosto,
    "--e-rodape-palavra": palavra,
  } as CSSProperties;
  return (
    <strong className="e-footer-marca" style={imagens}>
      <span className="e-footer-rosto" aria-hidden="true" />
      <span className="e-footer-palavra" aria-hidden="true" />
      <span className="e-footer-nome">Pixel</span>
    </strong>
  );
}
