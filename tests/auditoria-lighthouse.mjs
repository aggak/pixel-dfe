// Auditoria de acessibilidade do Lighthouse sobre o build de produção (issue #48).
// Uso: node tests/auditoria-lighthouse.mjs [pasta-dos-relatórios]
// O Lighthouse não é dependência do projeto: roda por `npx lighthouse@13.6.0` (baixado no cache do npx na primeira vez).
import { execFile, spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const processos = [];
const executarArquivo = promisify(execFile);

const paginas = [
  ["lista", "/"],
  ["quadro", "/quadro"],
  ["projetos", "/projetos"],
  ["projeto", "/projetos/1"],
  ["detalhe-tarefa", "/tarefas/1"],
  ["nova-tarefa", "/tarefas/nova"],
  ["editar-projeto", "/projetos/1/editar"],
];
// Blink: preferredColorScheme 0 = escuro, 1 = claro. A aparência da Pixel segue prefers-color-scheme.
const temas = [["claro", "1"], ["escuro", "0"]];
const dispositivos = [["mobile", []], ["desktop", ["--preset=desktop"]]];

async function portaLivre() {
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  return porta;
}

async function esperar(url) {
  for (let tentativa = 0; tentativa < 150; tentativa++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor indisponível: ${url}`);
}

function iniciar(arquivo, argumentos, env = process.env) {
  const processo = spawn(process.execPath, [join(raiz, arquivo), ...argumentos], { cwd: raiz, env, windowsHide: true, stdio: "ignore" });
  processos.push(processo);
}

async function auditar() {
  const saida = process.argv[2] ?? join(raiz, "lighthouse");
  await mkdir(saida, { recursive: true });
  const temporario = await mkdtemp(join(tmpdir(), "pixel-lighthouse-"));
  try {
    const banco = join(temporario, "db.json");
    await copyFile(join(raiz, "db.seed.json"), banco);
    const [portaApi, portaWeb] = [await portaLivre(), await portaLivre()];
    const api = `http://127.0.0.1:${portaApi}`;
    const web = `http://127.0.0.1:${portaWeb}`;
    const build = join(temporario, "dist");
    // Build de produção próprio, com a API temporária embutida, sem tocar no dist/ do projeto.
    await executarArquivo(process.execPath, [join(raiz, "node_modules/vite/bin/vite.js"), "build", "--outDir", build, "--emptyOutDir"], { cwd: raiz, env: { ...process.env, VITE_API_URL: api } });
    iniciar("node_modules/json-server/lib/bin.js", [banco, "--host", "127.0.0.1", "--port", String(portaApi)]);
    iniciar("node_modules/vite/bin/vite.js", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(portaWeb), "--strictPort"]);
    await Promise.all([esperar(`${api}/tarefas`), esperar(web)]);

    const linhas = [];
    for (const [pagina, caminho] of paginas) {
      for (const [dispositivo, extras] of dispositivos) {
        for (const [tema, esquema] of temas) {
          const arquivo = join(saida, `${pagina}-${dispositivo}-${tema}.json`);
          await executarArquivo("npx", ["--yes", "lighthouse@13.6.0", `${web}${caminho}`, "--only-categories=accessibility", "--output=json", `--output-path=${arquivo}`, "--quiet",
            `--chrome-flags="--headless=new --force-prefers-reduced-motion --blink-settings=preferredColorScheme=${esquema}"`, ...extras], { cwd: raiz, shell: true, maxBuffer: 64 * 1024 * 1024 });
          const relatorio = JSON.parse(await readFile(arquivo, "utf8"));
          const falhas = Object.values(relatorio.audits).filter((audit) => audit.score === 0 && audit.scoreDisplayMode === "binary").map((audit) => `${audit.id} (${audit.details?.items?.length ?? 0})`);
          const nota = Math.round(relatorio.categories.accessibility.score * 100);
          linhas.push({ pagina, dispositivo, tema, nota, falhas });
          console.log(`${pagina.padEnd(15)} ${dispositivo.padEnd(8)} ${tema.padEnd(7)} ${String(nota).padStart(3)}  ${falhas.join(", ") || "-"}`);
        }
      }
    }
    await writeFile(join(saida, "resumo.json"), JSON.stringify(linhas, null, 2));
  } finally {
    for (const processo of processos) processo.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(temporario, { recursive: true, force: true }).catch(() => {});
  }
}

auditar().catch((erro) => { console.error(erro); process.exitCode = 1; });
