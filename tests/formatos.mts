import assert from "node:assert/strict";
import {
  dataValida,
  formatarPrazoCartao,
  prazoVencido,
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
    for (const [ano, mes, dia, ontem, hoje, amanha] of [
      [2026, 10, 12, "2026-11-11", "2026-11-12", "2026-11-13"],
      [2026, 0, 1, "2025-12-31", "2026-01-01", "2026-01-02"],
      [2024, 2, 1, "2024-02-29", "2024-03-01", "2024-03-02"],
      [2025, 2, 1, "2025-02-28", "2025-03-01", "2025-03-02"],
      [1900, 2, 1, "1900-02-28", "1900-03-01", "1900-03-02"],
      [2000, 2, 1, "2000-02-29", "2000-03-01", "2000-03-02"],
      [2100, 2, 1, "2100-02-28", "2100-03-01", "2100-03-02"],
      [2026, 4, 1, "2026-04-30", "2026-05-01", "2026-05-02"],
    ] as const) {
      for (const [hora, minuto] of [
        [0, 0],
        [12, 0],
        [23, 59],
      ]) {
        const agora = new Date(ano, mes, dia, hora, minuto);
        assert.equal(
          prazoVencido(ontem, agora),
          true,
          `${fuso}: ${ontem} já venceu às ${hora}:${minuto}`,
        );
        assert.equal(
          prazoVencido(hoje, agora),
          false,
          `${fuso}: ${hoje} não vence no próprio dia`,
        );
        assert.equal(
          prazoVencido(amanha, agora),
          false,
          `${fuso}: ${amanha} ainda não venceu`,
        );
      }
    }
    for (const iso of [
      "",
      "inválido",
      "2020",
      "2020-1-01",
      "2020-01-1",
      "01/01/2020",
      " 2020-01-01",
      "2020-01-01 ",
      "2020-01-01T00:00:00Z",
    ]) {
      assert.equal(
        prazoVencido(iso, new Date(2026, 10, 12)),
        false,
        `${fuso}: formato inválido ${JSON.stringify(iso)}`,
      );
    }
    for (const iso of [
      "2026-02-30",
      "2026-04-31",
      "2025-02-29",
      "1900-02-29",
      "2100-02-29",
      "2026-13-01",
      "2026-01-00",
      "2026-00-01",
      "2026-01-32",
    ]) {
      assert.equal(
        prazoVencido(iso, new Date(2101, 0, 1)),
        false,
        `${fuso}: data inexistente ${iso}`,
      );
    }
    for (const iso of ["0000-02-29", "0096-02-29"]) {
      assert.equal(
        prazoVencido(iso, new Date(2026, 10, 12)),
        true,
        `${fuso}: data válida ${iso} já venceu`,
      );
    }
    console.log(
      `OK: prazo compara o dia local, inclusive viradas de mês/ano, e rejeita formatos inválidos e datas inexistentes em ${fuso}`,
    );
  }

  for (const [fuso, instante] of [
    ["America/Sao_Paulo", "2026-11-13T01:30:00Z"],
    ["Pacific/Kiritimati", "2026-11-11T12:30:00Z"],
  ]) {
    process.env.TZ = fuso;
    const hoje = new Date(instante);
    assert.equal(
      hoje.getDate(),
      12,
      `${fuso}: o instante está no dia 12 local`,
    );
    assert.equal(
      prazoVencido("2026-11-11", hoje),
      true,
      `${fuso}: ontem local venceu`,
    );
    assert.equal(
      prazoVencido("2026-11-12", hoje),
      false,
      `${fuso}: hoje local não venceu`,
    );
    assert.equal(
      prazoVencido("2026-11-13", hoje),
      false,
      `${fuso}: amanhã local não venceu`,
    );
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
  console.log("OK: prazo usa o dia local mesmo quando a data UTC é diferente");
} finally {
  if (fusoOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = fusoOriginal;
}
