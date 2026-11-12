import assert from "node:assert/strict";
import { iniciais, prazoVencido } from "../src/design/formatos.ts";

const monogramas = [
  ["Portal da biblioteca", "PB"],
  ["  engenharia   de\nsoftware\t", "ES"],
  ["Árvore e Órbita", "AO"],
  ["ac\u0327a\u0303o e educac\u0327a\u0303o", "AE"],
  ["Listas, árvores e grafos", "LA"],
  ["front-end", "FE"],
  ["Pixel", "PI"],
  ["Ágil", "AG"],
  ["a biblioteca", "BI"],
  ["X", "X"],
  ["3", "3"],
  ["2026", "20"],
  ["Projeto 2", "P2"],
  ["", "?"],
  [" \n\t ", "?"],
  ["---?! 🐈", "?"],
  ["de", "DE"],
  ["A e os", "A"],
  ["para", "PA"],
];

for (const [nome, esperado] of monogramas) assert.equal(iniciais(nome), esperado, JSON.stringify(nome));
for (const conectivo of ["a", "as", "o", "os", "da", "das", "de", "do", "dos", "e", "em", "para"]) {
  assert.equal(iniciais(`${conectivo} Portal ${conectivo} Biblioteca`), "PB", conectivo);
}
console.log("OK: iniciais removem acentos, ignoram conectivos, limitam letras e tratam nomes vazios");

const fusoOriginal = process.env.TZ;
try {
  for (const fuso of ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"]) {
    process.env.TZ = fuso;
    for (const [ano, mes, dia, ontem, hoje, amanha] of [
      [2026, 10, 12, "2026-11-11", "2026-11-12", "2026-11-13"],
      [2026, 0, 1, "2025-12-31", "2026-01-01", "2026-01-02"],
      [2024, 2, 1, "2024-02-29", "2024-03-01", "2024-03-02"],
      [2025, 2, 1, "2025-02-28", "2025-03-01", "2025-03-02"],
      [1900, 2, 1, "1900-02-28", "1900-03-01", "1900-03-02"],
      [2000, 2, 1, "2000-02-29", "2000-03-01", "2000-03-02"],
      [2100, 2, 1, "2100-02-28", "2100-03-01", "2100-03-02"],
      [2026, 4, 1, "2026-04-30", "2026-05-01", "2026-05-02"],
    ]) {
      for (const [hora, minuto] of [[0, 0], [12, 0], [23, 59]]) {
        const agora = new Date(ano, mes, dia, hora, minuto);
        assert.equal(prazoVencido(ontem, agora), true, `${fuso}: ${ontem} já venceu às ${hora}:${minuto}`);
        assert.equal(prazoVencido(hoje, agora), false, `${fuso}: ${hoje} não vence no próprio dia`);
        assert.equal(prazoVencido(amanha, agora), false, `${fuso}: ${amanha} ainda não venceu`);
      }
    }
    for (const iso of ["", "inválido", "2020", "2020-1-01", "2020-01-1", "01/01/2020", " 2020-01-01", "2020-01-01 ", "2020-01-01T00:00:00Z"]) {
      assert.equal(prazoVencido(iso, new Date(2026, 10, 12)), false, `${fuso}: formato inválido ${JSON.stringify(iso)}`);
    }
    for (const iso of ["2026-02-30", "2026-04-31", "2025-02-29", "1900-02-29", "2100-02-29", "2026-13-01", "2026-01-00", "2026-00-01", "2026-01-32"]) {
      assert.equal(prazoVencido(iso, new Date(2101, 0, 1)), false, `${fuso}: data inexistente ${iso}`);
    }
    for (const iso of ["0000-02-29", "0096-02-29"]) {
      assert.equal(prazoVencido(iso, new Date(2026, 10, 12)), true, `${fuso}: data válida ${iso} já venceu`);
    }
    console.log(`OK: prazo compara o dia local, inclusive viradas de mês/ano, e rejeita formatos inválidos e datas inexistentes em ${fuso}`);
  }

  for (const [fuso, instante] of [
    ["America/Sao_Paulo", "2026-11-13T01:30:00Z"],
    ["Pacific/Kiritimati", "2026-11-11T12:30:00Z"],
  ]) {
    process.env.TZ = fuso;
    const hoje = new Date(instante);
    assert.equal(hoje.getDate(), 12, `${fuso}: o instante está no dia 12 local`);
    assert.equal(prazoVencido("2026-11-11", hoje), true, `${fuso}: ontem local venceu`);
    assert.equal(prazoVencido("2026-11-12", hoje), false, `${fuso}: hoje local não venceu`);
    assert.equal(prazoVencido("2026-11-13", hoje), false, `${fuso}: amanhã local não venceu`);
  }
  console.log("OK: prazo usa o dia local mesmo quando a data UTC é diferente");
} finally {
  if (fusoOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = fusoOriginal;
}
