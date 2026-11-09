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

// Abertura decorativa: fica 2 s, some em 0,4 s e pode ser pulada com clique ou tecla.
export function Splash() {
  const [visivel, setVisivel] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches && !jaVisto());
  const [saindo, setSaindo] = useState(false);
  const pular = () => setSaindo(true);

  useEffect(() => {
    if (!visivel) return;
    try {
      sessionStorage.setItem(CHAVE, "1");
    } catch {
      // Sem sessionStorage, o splash só aparece de novo na próxima carga.
    }
    // Garantia caso a animação de saída não termine.
    const timer = setTimeout(() => setVisivel(false), saindo ? 400 : 3000);
    return () => clearTimeout(timer);
  }, [visivel, saindo]);

  useEffect(() => {
    if (!visivel) return;
    window.addEventListener("keydown", pular, { once: true });
    return () => window.removeEventListener("keydown", pular);
  }, [visivel]);

  if (!visivel) return null;
  return <div className={saindo ? "e-splash e-splash--saindo" : "e-splash"} aria-hidden="true" onPointerDown={pular} onAnimationEnd={(e) => { if (e.animationName === "e-splash-sair") setVisivel(false); }}>
    <Gatinho escala={6} />
    <span className="e-splash-nome">Pixel</span>
  </div>;
}
