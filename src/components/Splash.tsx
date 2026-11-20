import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useSprite } from "../temas/sprites";
import { movimentoReduzido } from "../hooks/useMovimento";

const CHAVE = "pixel-splash";
const DURACAO = 2500;
const SAIDA = 300;

function deveMostrar() {
  if (import.meta.env.VITE_SPLASH === "desligado") return false;
  try {
    return sessionStorage.getItem(CHAVE) !== "visto";
  } catch {
    return true;
  }
}

export function Splash() {
  const [fase, setFase] = useState<"visivel" | "saindo" | "fim">(() =>
    deveMostrar() ? "visivel" : "fim",
  );
  const ativo = fase !== "fim";
  const gato = useSprite("abanando");
  const palavra = useSprite("rodape-palavra");
  useLayoutEffect(() => {
    const raiz = document.getElementById("root");
    if (!raiz || !ativo) return;
    raiz.inert = true;
    return () => {
      raiz.inert = false;
    };
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    try {
      sessionStorage.setItem(CHAVE, "visto");
    } catch {
      return;
    }
  }, [ativo]);
  useEffect(() => {
    if (!ativo) return;
    const saida = movimentoReduzido() ? 0 : SAIDA;
    const sair = setTimeout(() => setFase("saindo"), DURACAO - saida);
    const fim = setTimeout(() => setFase("fim"), DURACAO);
    return () => {
      clearTimeout(sair);
      clearTimeout(fim);
    };
  }, [ativo]);
  if (!ativo) return null;
  const imagens = {
    "--e-gato": gato,
    "--e-splash-palavra": palavra,
  } as CSSProperties;
  return createPortal(
    <div
      className={`e-splash${fase === "saindo" ? " e-splash-saindo" : ""}`}
      style={imagens}
      aria-hidden="true"
      onPointerDown={(evento) => evento.preventDefault()}
    >
      <span className="e-splash-gato" />
      <span className="e-splash-palavra" />
    </div>,
    document.body,
  );
}
