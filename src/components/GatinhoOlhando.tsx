import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoOlhando() {
  const sprite = useSprite("olhando");
  return (
    <span
      className="e-gato-olhando"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
