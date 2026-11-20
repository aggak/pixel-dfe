import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoCochilando() {
  const sprite = useSprite("cochilando");
  return (
    <span
      className="e-gato-cochilando"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
