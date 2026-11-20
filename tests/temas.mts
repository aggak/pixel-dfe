import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORES_DO_NUCLEO,
  CORES_DOS_COMPONENTES,
  PALETA_PIXEL,
  PARES_DE_CONTRASTE,
  TEMAS_DE_CORES,
} from "../src/temas/catalogo.ts";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const pastaTemas = join(raiz, "src/temas");
const CONTRATO = new Set<string>([
  ...CORES_DO_NUCLEO,
  ...CORES_DOS_COMPONENTES,
  ...Object.keys(PALETA_PIXEL),
]);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const COR_FIXA =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

function declaracoes(css: string, seletor: string) {
  const inicio = css.indexOf(`${seletor} {`);
  if (inicio < 0) return null;
  const corpo = css.slice(
    css.indexOf("{", inicio) + 1,
    css.indexOf("}", inicio),
  );
  const mapa = new Map<string, string>();
  for (const linha of corpo.split(";")) {
    const separador = linha.indexOf(":");
    if (separador < 0) continue;
    mapa.set(
      linha.slice(0, separador).trim(),
      linha.slice(separador + 1).trim(),
    );
  }
  return mapa;
}

function luminancia(hex: string) {
  const cheio =
    hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(cheio.slice(i, i + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

const ESQUEMAS = ["escuro", "claro"] as const;
const PROPRIOS = new Set(["base.css", "camadas.css"]);
const arquivosDeTema = readdirSync(pastaTemas)
  .filter((arquivo) => arquivo.endsWith(".css") && !PROPRIOS.has(arquivo))
  .map((arquivo) => arquivo.replace(/\.css$/, ""))
  .sort();
assert.deepEqual(
  arquivosDeTema,
  TEMAS_DE_CORES.map(({ id }) => id).sort(),
  "cada tema do catálogo precisa de um src/temas/<id>.css e cada arquivo precisa estar no catálogo",
);
assert.equal(
  new Set(TEMAS_DE_CORES.map(({ id }) => id)).size,
  TEMAS_DE_CORES.length,
  "ids de tema repetidos no catálogo",
);
for (const tema of TEMAS_DE_CORES)
  assert.ok(
    (ESQUEMAS as readonly string[]).includes(tema.esquema),
    `${tema.id}: esquema "${tema.esquema}" não existe`,
  );

const base = declaracoes(
  readFileSync(join(pastaTemas, "base.css"), "utf8"),
  ":where(:root, [data-tema], [data-esquema])",
);
assert.ok(base, "src/temas/base.css precisa de um bloco :where(:root, [data-tema], [data-esquema])");
for (const nome of CORES_DOS_COMPONENTES)
  assert.ok(base.has(nome), `base.css não traz o valor de reserva de ${nome}`);

function conferirValores(origem: string, cores: Map<string, string>) {
  for (const nome of cores.keys())
    if (nome.startsWith("--"))
      assert.ok(
        CONTRATO.has(nome),
        `${origem} define ${nome}, que não está no contrato`,
      );
  for (const nome of CORES_DO_NUCLEO) {
    const valor = cores.get(nome);
    if (valor)
      assert.match(
        valor,
        HEX,
        `${origem}: ${nome} precisa ser hexadecimal (#rrggbb)`,
      );
  }
  for (const nome of Object.keys(PALETA_PIXEL)) {
    const valor = cores.get(nome);
    if (valor)
      assert.match(
        valor,
        /^#[0-9a-f]{6}$/i,
        `${origem}: ${nome} precisa ser hexadecimal de 6 dígitos (#rrggbb)`,
      );
  }
}

const bases = new Map<string, Map<string, string>>();
for (const esquema of ESQUEMAS) {
  const origem = `esquemas/${esquema}.css`;
  const cores = declaracoes(
    readFileSync(join(pastaTemas, origem), "utf8"),
    `[data-esquema="${esquema}"]`,
  );
  assert.ok(
    cores,
    `${origem} precisa do bloco [data-esquema="${esquema}"]`,
  );
  assert.equal(
    cores.get("color-scheme"),
    esquema === "escuro" ? "dark" : "light",
    `${origem} precisa de color-scheme ${esquema === "escuro" ? "dark" : "light"}`,
  );
  for (const nome of CORES_DO_NUCLEO)
    assert.ok(cores.has(nome), `${origem} não define ${nome}`);
  for (const nome of Object.keys(PALETA_PIXEL))
    assert.ok(cores.has(nome), `${origem} não isola a cor ${nome} na paleta do esquema`);
  for (const nome of CORES_DOS_COMPONENTES) {
    const reserva = cores.get(nome) ?? base.get(nome);
    assert.ok(
      CORES_DO_NUCLEO.some((cor) => reserva?.includes(`var(${cor})`)),
      `${origem}: a reserva de ${nome} precisa acompanhar o núcleo do tema`,
    );
  }
  conferirValores(origem, cores);
  bases.set(esquema, cores);
}

const falhasDeContraste: string[] = [];
for (const tema of TEMAS_DE_CORES) {
  const origem = `${tema.id}.css`;
  const proprias = declaracoes(
    readFileSync(join(pastaTemas, origem), "utf8"),
    `[data-tema="${tema.id}"]`,
  );
  assert.ok(
    proprias,
    `${origem} precisa do bloco [data-tema="${tema.id}"]`,
  );
  assert.ok(
    !proprias.has("color-scheme"),
    `${origem} não define color-scheme: ele vem do esquema "${tema.esquema}" no catálogo`,
  );
  conferirValores(origem, proprias);
  const cores = new Map([...bases.get(tema.esquema), ...proprias]);
  for (const [texto, fundo, minimo] of PARES_DE_CONTRASTE) {
    const a = cores.get(texto);
    const b = cores.get(fundo);
    if (!a || !b || !HEX.test(a) || !HEX.test(b)) continue;
    const razao = contraste(a, b);
    if (razao < minimo)
      falhasDeContraste.push(
        `${tema.id}: ${texto} (${a}) sobre ${fundo} (${b}) tem ${razao.toFixed(2)}:1, mínimo ${minimo}:1`,
      );
  }
}
assert.deepEqual(falhasDeContraste, [], falhasDeContraste.join("\n"));

const LIVRES = ["src/temas/", "src/design/vendor/", "src/assets/"];
function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}
const coresFixas: string[] = [];
for (const caminho of arquivos(join(raiz, "src"))) {
  const relativo = relative(raiz, caminho).replaceAll("\\", "/");
  if (!/\.(css|tsx?)$/.test(relativo)) continue;
  if (LIVRES.some((livre) => relativo.startsWith(livre))) continue;
  readFileSync(caminho, "utf8")
    .split("\n")
    .forEach((linha, indice) => {
      if (COR_FIXA.test(linha))
        coresFixas.push(`${relativo}:${indice + 1}: ${linha.trim()}`);
    });
}
assert.deepEqual(
  coresFixas,
  [],
  `cores fixas fora de src/temas (use as variáveis do contrato):\n${coresFixas.join("\n")}`,
);

const pastaSprites = join(raiz, "src/assets/gatinho");
const originais = new Set(Object.values(PALETA_PIXEL));
const tonsDeFora: string[] = [];
for (const sprite of readdirSync(pastaSprites).filter((nome) =>
  nome.endsWith("-escuro.svg"),
)) {
  const tons = readFileSync(join(pastaSprites, sprite), "utf8").match(
    /#[0-9a-f]{3,8}\b/gi,
  );
  for (const tom of new Set(tons ?? []))
    if (!originais.has(tom.toLowerCase())) tonsDeFora.push(`${sprite}: ${tom}`);
}
assert.deepEqual(
  tonsDeFora,
  [],
  `tons dos sprites fora de PALETA_PIXEL (o tema não conseguiria recolori-los):\n${tonsDeFora.join("\n")}`,
);

console.log(
  `OK: ${TEMAS_DE_CORES.length} tema(s) cumprem o contrato de ${CONTRATO.size} cores, ${PARES_DE_CONTRASTE.length} pares de contraste, sprites dentro da paleta pixel e nenhuma cor fixa fora de src/temas`,
);
