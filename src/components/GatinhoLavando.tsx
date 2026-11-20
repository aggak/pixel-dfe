import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoLavando() {
  const sprite = useSprite("lavando");
  return (
    <span
      className="e-gato-lavando"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
