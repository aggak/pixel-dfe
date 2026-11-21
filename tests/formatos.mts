import assert from "node:assert/strict";
import { dataValida, formatarPrazoCartao } from "../src/design/formatos.ts";
import { TEMAS, temasDosProjetos } from "../src/design/temas-felinos.ts";

const projeto = (id: string, criadoEm = "2026-08-10") => ({
  id,
  nome: `Projeto ${id}`,
  descricao: "",
  disciplina: "",
  criadoEm,
});
const varios = Array.from({ length: TEMAS.length }, (_, i) =>
  projeto(String(i + 1)),
);
const sorteio = temasDosProjetos(varios);
assert.equal(
  new Set(varios.map(({ id }) => sorteio.get(id)?.id)).size,
  TEMAS.length,
);
assert.deepEqual(
  temasDosProjetos([...varios].reverse()).get("7"),
  sorteio.get("7"),
);
const sozinho = temasDosProjetos([projeto("abc")]).get("abc");
assert.equal(
  temasDosProjetos([projeto("abc"), projeto("xyz", "2026-09-01")]).get("abc"),
  sozinho,
);
const excedente = temasDosProjetos([...varios, projeto("extra", "2026-12-01")]);
assert.ok(excedente.get("extra"));
for (const tema of TEMAS) {
  assert.equal(tema.desenho.length, 16, tema.id);
  for (const linha of tema.desenho)
    assert.equal([...linha].length, 16, tema.id);
}
console.log(
  "OK: temas felinos são estáveis por projeto e só se repetem quando o catálogo acaba",
);

for (const iso of ["2026-12-20", "2024-02-29", "0000-02-29", "9999-12-31"])
  assert.equal(dataValida(iso), true, iso);
for (const iso of [
  "",
  "20265-12-20",
  "2026-02-30",
  "2025-02-29",
  "2026-13-01",
  "2026-1-01",
  "20/12/2026",
  " 2026-12-20",
  "2026-12-20T00:00:00Z",
])
  assert.equal(dataValida(iso), false, JSON.stringify(iso));
console.log(
  "OK: data válida exige AAAA-MM-DD com ano de quatro dígitos e dia existente",
);

const fusoOriginal = process.env.TZ;
try {
  for (const fuso of ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"]) {
    process.env.TZ = fuso;
    const agora = new Date(2026, 10, 12);
    for (const [iso, esperado] of [
      ["2020-01-05", "5 jan 2020"],
      ["2026-01-05", "5 jan"],
      ["2027-01-10", "10 jan 2027"],
      ["2025-12-31", "31 dez 2025"],
      ["inválido", "inválido"],
    ]) {
      assert.equal(
        formatarPrazoCartao(iso, agora),
        esperado,
        `${fuso}: prazo ${iso}`,
      );
    }
  }
  for (const [fuso, instante, iso, esperado] of [
    ["America/Sao_Paulo", "2027-01-01T01:30:00Z", "2026-01-05", "5 jan"],
    ["America/Sao_Paulo", "2027-01-01T01:30:00Z", "2027-01-05", "5 jan 2027"],
    ["Pacific/Kiritimati", "2026-12-31T12:30:00Z", "2027-01-05", "5 jan"],
    ["Pacific/Kiritimati", "2026-12-31T12:30:00Z", "2026-01-05", "5 jan 2026"],
  ]) {
    process.env.TZ = fuso;
    assert.equal(
      formatarPrazoCartao(iso, new Date(instante)),
      esperado,
      `${fuso}: ano local`,
    );
  }
  console.log(
    "OK: prazo compacto inclui outro ano e usa o ano local na virada",
  );
} finally {
  if (fusoOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = fusoOriginal;
}
