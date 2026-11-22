import assert from "node:assert/strict";
import {
  dataValida,
  diasAtePrazo,
  formatarPrazoCartao,
  lerPrazo,
} from "../src/design/formatos.ts";
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
  for (const fuso of ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"]) {
    process.env.TZ = fuso;
    const hoje = new Date(2026, 10, 12, 23, 30);
    for (const [iso, concluida, dias, estado, frase] of [
      ["2020-01-05", false, -2503, "atrasada", "Venceu há 2503 dias, num domingo"],
      ["2026-11-10", false, -2, "atrasada", "Venceu há 2 dias, numa terça-feira"],
      ["2026-11-11", false, -1, "atrasada", "Venceu ontem, numa quarta-feira"],
      ["2026-11-12", false, 0, "perto", "Vence hoje, numa quinta-feira"],
      ["2026-11-13", false, 1, "perto", "Vence amanhã, numa sexta-feira"],
      ["2026-11-14", false, 2, "perto", "Faltam 2 dias, cai num sábado"],
      ["2026-11-15", false, 3, "longe", "Faltam 3 dias, cai num domingo"],
      ["2026-11-11", true, -1, "concluida", "Prazo numa quarta-feira"],
    ] as const) {
      assert.equal(diasAtePrazo(iso, hoje), dias, `${fuso}: dias até ${iso}`);
      const [, mes, dia] = iso.split("-").map(Number);
      assert.deepEqual(
        lerPrazo(iso, concluida, hoje),
        { dia, mes: mes - 1, estado, frase },
        `${fuso}: prazo ${iso}`,
      );
    }
    // Anos de dois dígitos continuam no próprio século.
    assert.equal(
      diasAtePrazo("0099-12-31", hoje),
      Math.round((Date.parse("0099-12-31") - Date.UTC(2026, 10, 12)) / 864e5),
    );
    assert.equal(
      lerPrazo("0099-12-31", true, hoje)?.frase,
      "Prazo numa quinta-feira",
    );
    assert.equal(diasAtePrazo("2026-02-30", hoje), undefined);
    assert.equal(lerPrazo("inválido", false, hoje), undefined);
  }
  console.log(
    "OK: a frase do prazo conta dias corridos no dia local e lê o ISO em UTC, inclusive nos anos 0000 a 0099",
  );
} finally {
  if (fusoOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = fusoOriginal;
}
