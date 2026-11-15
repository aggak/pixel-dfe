import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = dirname(fileURLToPath(import.meta.url));
const raiz = join(pasta, "..");
const SOB_DEMANDA = ["auditoria-lighthouse.mjs", "rotas-publicadas.mjs", "verificar-publicacao.mjs"];
const FORA = new Set([basename(fileURLToPath(import.meta.url)), "ui.cjs", "apoio.cjs", ...SOB_DEMANDA]);
const LIMITE_MS = 600_000;
const TENTATIVAS = 2;
const LINHAS_DE_FALHA = 40;

const nome = (arquivo) => arquivo.replace(/\.[cm]js$/, "");
const segundos = (ms) => `${Math.round(ms / 1000)} s`;

const suites = readdirSync(pasta).filter((arquivo) => /\.[cm]js$/.test(arquivo) && !FORA.has(arquivo)).sort();
const pedidas = process.argv.slice(2).map((pedido) => nome(basename(pedido)));
const desconhecidas = pedidas.filter((pedido) => !suites.some((suite) => nome(suite) === pedido));
if (desconhecidas.length) {
  const sobDemanda = desconhecidas.filter((pedido) => SOB_DEMANDA.some((suite) => nome(suite) === pedido));
  for (const pedido of sobDemanda) console.error(`${pedido} fica fora da rodada e roda só sob demanda: node tests/${SOB_DEMANDA.find((suite) => nome(suite) === pedido)}`);
  const restantes = desconhecidas.filter((pedido) => !sobDemanda.includes(pedido));
  if (restantes.length) console.error(`Suíte desconhecida: ${restantes.join(", ")}\nDisponíveis: ${suites.map(nome).join(", ")}`);
  process.exit(1);
}
const escolhidas = pedidas.length ? suites.filter((suite) => pedidas.includes(nome(suite))) : suites;

let atual;
function encerrar(processo, sinal) {
  if (!processo?.pid || processo.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(processo.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-processo.pid, sinal);
  } catch {}
}
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    encerrar(atual, "SIGKILL");
    process.exit(130);
  });
}

function rodar(suite) {
  return new Promise((resolve) => {
    const partes = [];
    const processo = spawn(process.execPath, [join("tests", suite)], {
      cwd: raiz,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    atual = processo;
    let estourou = false;
    const limite = setTimeout(() => {
      estourou = true;
      encerrar(processo, "SIGKILL");
    }, LIMITE_MS);
    processo.stdout.on("data", (parte) => partes.push(parte));
    processo.stderr.on("data", (parte) => partes.push(parte));
    processo.on("close", (codigo) => {
      clearTimeout(limite);
      encerrar(processo, "SIGKILL");
      resolve({ passou: codigo === 0 && !estourou, estourou, saida: Buffer.concat(partes).toString("utf8") });
    });
  });
}

const inicio = Date.now();
const falhas = [];
const repetidas = [];
const largura = String(escolhidas.length).length;

for (const [indice, suite] of escolhidas.entries()) {
  process.stdout.write(`[${String(indice + 1).padStart(largura)}/${escolhidas.length}] ${nome(suite)} `);
  const comeco = Date.now();
  let resultado;
  let tentativa = 0;
  while (tentativa < TENTATIVAS) {
    tentativa++;
    resultado = await rodar(suite);
    if (resultado.passou) break;
  }
  const tempo = segundos(Date.now() - comeco);
  if (resultado.passou && tentativa === 1) {
    console.log(`ok (${tempo})`);
  } else if (resultado.passou) {
    repetidas.push(nome(suite));
    console.log(`ok na ${tentativa}ª tentativa (${tempo})`);
  } else {
    falhas.push(nome(suite));
    console.log(`FALHOU${resultado.estourou ? ` por passar de ${segundos(LIMITE_MS)}` : ""} (${tempo})`);
    console.log(resultado.saida.trimEnd().split("\n").slice(-LINHAS_DE_FALHA).map((linha) => `    ${linha}`).join("\n"));
  }
}

const aprovadas = escolhidas.length - falhas.length;
console.log(`\n${aprovadas} de ${escolhidas.length} suítes aprovadas em ${segundos(Date.now() - inicio)}.`);
if (repetidas.length) console.log(`Passaram só ao repetir: ${repetidas.join(", ")}.`);
if (falhas.length) {
  console.log(`Falharam: ${falhas.join(", ")}.`);
  process.exitCode = 1;
}
