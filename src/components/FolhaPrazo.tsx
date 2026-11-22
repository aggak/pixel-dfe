/* Folha de calendário em pixel art, irmã maior do ícone 7×7: grade de
   23×24, um pixel = 2 px de tela. Letras de 5 de altura e algarismos 5×7,
   no traço fino dos ícones. É só enfeite: quem lê a data é o texto ao lado. */
const LETRAS: Record<string, string> = {
  A: "0110 1001 1111 1001 1001",
  B: "1110 1001 1110 1001 1110",
  D: "1110 1001 1001 1001 1110",
  E: "1111 1000 1110 1000 1111",
  F: "1111 1000 1110 1000 1000",
  G: "0111 1000 1011 1001 0111",
  I: "111 010 010 010 111",
  J: "0011 0001 0001 1001 0110",
  L: "1000 1000 1000 1000 1111",
  M: "10001 11011 10101 10001 10001",
  N: "1001 1101 1011 1001 1001",
  O: "0110 1001 1001 1001 0110",
  R: "1110 1001 1110 1010 1001",
  S: "0111 1000 0110 0001 1110",
  T: "11111 00100 00100 00100 00100",
  U: "1001 1001 1001 1001 0110",
  V: "10001 10001 01010 01010 00100",
  Z: "1111 0001 0110 1000 1111",
};
const ALGARISMOS = [
  "01110 10001 10001 10001 10001 10001 01110",
  "00100 01100 00100 00100 00100 00100 01110",
  "01110 10001 00001 00010 00100 01000 11111",
  "01110 10001 00001 00110 00001 10001 01110",
  "00010 00110 01010 10010 11111 00010 00010",
  "11111 10000 11110 00001 00001 10001 01110",
  "00110 01000 10000 11110 10001 10001 01110",
  "11111 00001 00010 00100 00100 00100 00100",
  "01110 10001 10001 01110 10001 10001 01110",
  "01110 10001 10001 01111 00001 00010 01100",
];
const MESES = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];
const LARGURA = 23;

function tracar(desenho: string, x0: number, y0: number) {
  let d = "";
  desenho.split(" ").forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      if (linha[x] !== "1") continue;
      let fim = x;
      while (linha[fim + 1] === "1") fim++;
      d += `M${x0 + x} ${y0 + y}h${fim - x + 1}v1h${x - fim - 1}z`;
      x = fim;
    }
  });
  return d;
}

function escrever(desenhos: string[], y: number) {
  const larguras = desenhos.map((desenho) => desenho.indexOf(" "));
  const total = larguras.reduce((soma, largura) => soma + largura + 1, -1);
  let x = Math.floor((LARGURA - total) / 2);
  return desenhos
    .map((desenho, indice) => {
      const d = tracar(desenho, x, y);
      x += larguras[indice] + 1;
      return d;
    })
    .join("");
}

export function FolhaPrazo({ dia, mes }: { dia: number; mes: number }) {
  const letras = [...MESES[mes]].map((letra) => LETRAS[letra]);
  const algarismos = [...String(dia).padStart(2, "0")].map(
    (algarismo) => ALGARISMOS[Number(algarismo)],
  );
  return (
    <svg
      className="fol-folha"
      viewBox="0 0 23 24"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path className="fo-papel" d="M1 10h21v11H1z" />
      <path className="fo-bloco" d="M1 22h21v1H1z" />
      <path className="fo-faixa" d="M1 2h21v7H1z" />
      <path className="fo-faixa-base" d="M1 9h21v1H1z" />
      <path
        className="fo-contorno"
        d="M1 1h21v1H1zM0 2h1v21H0zM22 2h1v21h-1zM1 21h21v1H1zM1 23h21v1H1zM5 0h2v2H5zM16 0h2v2h-2z"
      />
      <path className="fo-mes" d={escrever(letras, 3)} />
      <path className="fo-dia" d={escrever(algarismos, 12)} />
    </svg>
  );
}
