import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoDormindo() {
  const sprite = useSprite("dormindo");
  return (
    <span
      className="e-gato-dormindo"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
