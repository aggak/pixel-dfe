import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoCarregando() {
  const sprite = useSprite("carregando");
  return (
    <span
      className="e-gato-carregando"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
