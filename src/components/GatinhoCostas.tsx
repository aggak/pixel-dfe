import type { CSSProperties } from "react";
import { useSprite } from "../temas/sprites";

export function GatinhoCostas() {
  const sprite = useSprite("costas");
  return (
    <span
      className="e-gato-costas"
      style={{ "--e-gato": sprite } as CSSProperties}
      aria-hidden="true"
    />
  );
}
