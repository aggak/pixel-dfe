import { useEffect, useState } from "react";
import { Gatinho } from "./Gatinho";

const CHAVE = "pixel:splash-visto";

function jaVisto() {
  try {
    return sessionStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

// Abertura decorativa: aparece só na primeira carga da sessão e nunca captura cliques.
export function Splash() {
  const [visivel, setVisivel] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches && !jaVisto());

  useEffect(() => {
    if (!visivel) return;
    try {
      sessionStorage.setItem(CHAVE, "1");
    } catch {
      // Sem sessionStorage, o splash só aparece de novo na próxima carga.
    }
    // Garantia caso a animação de saída não termine.
    const timer = setTimeout(() => setVisivel(false), 1000);
    return () => clearTimeout(timer);
  }, [visivel]);

  if (!visivel) return null;
  return <div className="e-splash" aria-hidden="true" onAnimationEnd={(e) => { if (e.animationName === "e-splash-sair") setVisivel(false); }}>
    <Gatinho escala={6} />
    <span className="e-splash-nome">Pixel</span>
  </div>;
}
