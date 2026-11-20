import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoAbanando() {
  const sprite = useSprite("abanando");
  return (
    <span
      className="e-gato-abanando"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
