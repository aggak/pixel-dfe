export type Esquema = "escuro" | "claro";

export interface TemaDeCores {
  id: string;
  nome: string;
  esquema: Esquema;
}

export const TEMAS_DE_CORES: TemaDeCores[] = [
  { id: "ameixa", nome: "Ameixa", esquema: "escuro" },
  { id: "floresta", nome: "Floresta", esquema: "escuro" },
  { id: "ameixa-clara", nome: "Ameixa clara", esquema: "claro" },
];

export const CORES_DO_NUCLEO = [
  "--e-back",
  "--e-sheet",
  "--e-ink",
  "--e-muted",
  "--e-line",
  "--e-control",
  "--e-action",
  "--e-mark",
  "--e-error",
  "--e-priority-alta",
  "--e-priority-media",
  "--e-priority-baixa",
  "--e-status-em-andamento",
  "--e-status-em-revisao",
  "--e-status-concluida",
] as const;

export const CORES_DOS_COMPONENTES = [
  "--e-ficha-fundo",
  "--e-ficha-borda",
  "--e-ficha-sombra",
  "--e-ficha-compacta-fundo",
  "--e-ficha-compacta-sombra",
  "--e-campo-fundo",
  "--e-campo-borda",
  "--e-campo-realce",
  "--e-menu-fundo",
  "--e-menu-borda",
  "--e-menu-sombra",
  "--e-cartao-sombra",
  "--e-aba-sombra",
  "--e-veu",
] as const;

export const PALETA_PIXEL: Record<string, string> = {
  "--e-gato-tinta": "#2a1c33",
  "--e-gato-contorno": "#4e3760",
  "--e-gato-pelo-1": "#7d5e90",
  "--e-gato-pelo-2": "#9a72ab",
  "--e-gato-pelo-3": "#bb91ca",
  "--e-gato-pelo-4": "#cfaedb",
  "--e-gato-pelo-5": "#e4d0ec",
  "--e-gato-branco": "#f3eaf5",
  "--e-gato-rosa-escuro": "#c97c98",
  "--e-gato-rosa": "#f2a7bf",
  "--e-gato-sono": "#8c7d98",
  "--e-pixel-amarelo": "#f1d38a",
  "--e-pixel-amarelo-escuro": "#c4954f",
  "--e-pixel-azul": "#8fb4e3",
  "--e-pixel-azul-escuro": "#5a78b0",
  "--e-pixel-verde": "#9fd3b1",
  "--e-pixel-verde-escuro": "#5f9c7f",
  "--e-pixel-vermelho": "#e7756f",
  "--e-logo-1": "#4e3563",
  "--e-logo-2": "#78538e",
  "--e-logo-3": "#a17ab4",
  "--e-logo-4": "#b38bc8",
  "--e-logo-5": "#c9a5dc",
  "--e-logo-6": "#cdb2db",
  "--e-logo-7": "#dbc4e8",
  "--e-logo-8": "#dfc8ec",
  "--e-logo-9": "#e8d4f2",
  "--e-logo-10": "#eadbf2",
  "--e-logo-11": "#f0e3f6",
  "--e-logo-12": "#f7edfc",
  "--e-logo-13": "#faf3fd",
};

export function corPixel(nome: string) {
  return `var(${nome}, ${PALETA_PIXEL[nome]})`;
}

export const PARES_DE_CONTRASTE: [string, string, number][] = [
  ["--e-ink", "--e-back", 4.5],
  ["--e-ink", "--e-sheet", 4.5],
  ["--e-muted", "--e-back", 4.5],
  ["--e-muted", "--e-sheet", 4.5],
  ["--e-action", "--e-back", 4.5],
  ["--e-action", "--e-sheet", 4.5],
  ["--e-error", "--e-sheet", 4.5],
  ["--e-ink", "--e-mark", 4.5],
  ["--e-control", "--e-sheet", 3],
  ["--e-priority-alta", "--e-sheet", 4.5],
  ["--e-priority-media", "--e-sheet", 4.5],
  ["--e-priority-baixa", "--e-sheet", 4.5],
  ["--e-status-em-andamento", "--e-sheet", 4.5],
  ["--e-status-em-revisao", "--e-sheet", 4.5],
  ["--e-status-concluida", "--e-sheet", 4.5],
  ["--e-ink", "--e-ficha-fundo", 4.5],
  ["--e-muted", "--e-ficha-fundo", 4.5],
  ["--e-ink", "--e-ficha-compacta-fundo", 4.5],
  ["--e-ink", "--e-campo-fundo", 4.5],
  ["--e-campo-borda", "--e-campo-fundo", 3],
  ["--e-ink", "--e-menu-fundo", 4.5],
];
