const { spawn } = require("node:child_process");
const { copyFile, mkdtemp, rm } = require("node:fs/promises");
const { createServer } = require("node:net");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { lancarNavegador } = require("./ui.cjs");

const raiz = join(__dirname, "..");
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const ativo = (processo) =>
  processo.pid && processo.exitCode === null && processo.signalCode === null;

function criarApoio() {
  const portasUsadas = new Set();
  const processos = [];
  const temporarios = [];
  const recursos = [];
  let encerramento;

  async function portaLivre() {
    for (;;) {
      const servidor = createServer();
      await new Promise((resolver, rejeitar) => {
        servidor.once("error", rejeitar);
        servidor.listen(0, "127.0.0.1", resolver);
      });
      const porta = servidor.address().port;
      await new Promise((resolver) => servidor.close(resolver));
      if (!portasUsadas.has(porta)) {
        portasUsadas.add(porta);
        return porta;
      }
    }
  }

  function iniciar(
    arquivo,
    argumentos,
    env = process.env,
    { exibirErros = true, servidor = true } = {},
  ) {
    const processo = spawn(
      process.execPath,
      [resolve(raiz, arquivo), ...argumentos],
      { cwd: raiz, env, windowsHide: true, stdio: "pipe" },
    );
    processo.stdout.on("data", () => {});
    if (exibirErros)
      processo.stderr.on("data", (dado) => process.stderr.write(dado));
    processo.once("error", (erro) => {
      processo.erroInicio = erro;
    });
    processo.parado = !servidor;
    processos.push(processo);
    return processo;
  }

  function rodar(
    descricao,
    arquivo,
    argumentos,
    env,
    { exibirErros = false } = {},
  ) {
    return new Promise((resolver, rejeitar) => {
      const processo = iniciar(arquivo, argumentos, env, {
        exibirErros,
        servidor: false,
      });
      let saida = "";
      processo.stdout.on("data", (dado) => {
        saida += dado;
      });
      processo.stderr.on("data", (dado) => {
        saida += dado;
      });
      processo.once("error", rejeitar);
      processo.once("exit", (codigo) =>
        codigo === 0
          ? resolver()
          : rejeitar(
              new Error(
                `${descricao} terminou com código ${codigo}:\n${saida}`,
              ),
            ),
      );
    });
  }

  async function esperar(
    url,
    { tentativas = 100, processo, confirmar = async () => true } = {},
  ) {
    for (let tentativa = 0; tentativa < tentativas; tentativa++) {
      const servidores = processo
        ? [processo]
        : processos.filter((item) => !item.parado);
      const falhou = servidores.find((item) => item.erroInicio || !ativo(item));
      if (falhou)
        throw (
          falhou.erroInicio ||
          new Error(`Servidor encerrou antes do teste: ${url}`)
        );
      try {
        const resposta = await fetch(url, {
          signal: AbortSignal.timeout(1000),
        });
        if (
          resposta.ok &&
          (await confirmar(resposta)) &&
          servidores.every(ativo)
        )
          return;
      } catch {}
      await dormir(100);
    }
    throw new Error(`Servidor indisponível: ${url}`);
  }

  async function criarTemporario(prefixo, pasta = tmpdir()) {
    const temporario = await mkdtemp(join(pasta, prefixo));
    temporarios.push(temporario);
    return temporario;
  }

  async function criarBanco({
    prefixo = "pixel-testes-",
    pasta,
    semente = "db.seed.json",
  } = {}) {
    const temporario = await criarTemporario(prefixo, pasta);
    const banco = join(temporario, "db.json");
    await copyFile(resolve(raiz, semente), banco);
    return { temporario, banco };
  }

  async function encerrarProcesso(processo) {
    processo.parado = true;
    if (!ativo(processo)) return;
    const fim = new Promise((resolver) => processo.once("exit", resolver));
    processo.kill();
    const limite = setTimeout(() => {
      if (ativo(processo)) processo.kill("SIGKILL");
    }, 3000);
    try {
      await fim;
    } finally {
      clearTimeout(limite);
    }
  }

  async function subir(
    descricao,
    arquivo,
    argumentos,
    env,
    caminhoTeste,
    confirmar,
  ) {
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const porta = await portaLivre();
      const base = `http://127.0.0.1:${porta}`;
      const processo = iniciar(arquivo, argumentos(porta), env);
      try {
        await esperar(`${base}${caminhoTeste}`, {
          tentativas: 150,
          processo,
          confirmar,
        });
        return base;
      } catch {
        await encerrarProcesso(processo);
        console.warn(
          `Aviso: ${descricao} não iniciou na porta ${porta} (tentativa ${tentativa}).`,
        );
      }
    }
    throw new Error(`Não foi possível iniciar ${descricao}.`);
  }

  function iniciarApi(banco, porta) {
    return iniciar("node_modules/json-server/lib/bin.js", [
      banco,
      "--host",
      "127.0.0.1",
      "--port",
      String(porta),
    ]);
  }

  function iniciarVite(
    porta,
    { api, argumentos = [], env = process.env, preview } = {},
  ) {
    return iniciar(
      "node_modules/vite/bin/vite.js",
      [
        ...(preview ? ["preview", "--outDir", preview] : []),
        "--host",
        "127.0.0.1",
        "--port",
        String(porta),
        "--strictPort",
        ...argumentos,
      ],
      api ? { ...env, VITE_API_URL: api } : env,
    );
  }

  async function subirAmbiente({
    banco,
    rotaApi = "/tarefas",
    tentativas = 100,
    ...vite
  } = {}) {
    const portaApi = await portaLivre();
    const portaWeb = await portaLivre();
    const api = `http://127.0.0.1:${portaApi}`;
    const web = `http://127.0.0.1:${portaWeb}`;
    iniciarApi(banco, portaApi);
    iniciarVite(portaWeb, { ...vite, api });
    await Promise.all([
      esperar(`${api}${rotaApi}`, { tentativas }),
      esperar(web, { tentativas }),
    ]);
    return { api, web };
  }

  function registrar(recurso) {
    recursos.push(recurso);
    return recurso;
  }

  async function abrirNavegador() {
    return registrar(await lancarNavegador());
  }

  function encerrar() {
    encerramento ||= (async () => {
      const resultados = await Promise.allSettled(
        recursos
          .reverse()
          .map((recurso) => Promise.resolve().then(() => recurso.close())),
      );
      resultados.push(
        ...(await Promise.allSettled(processos.map(encerrarProcesso))),
      );
      resultados.push(
        ...(await Promise.allSettled(
          temporarios.map((pasta) =>
            rm(pasta, { recursive: true, force: true }),
          ),
        )),
      );
      for (const [sinal, handler] of sinais) process.off(sinal, handler);
      const falha = resultados.find(
        (resultado) => resultado.status === "rejected",
      );
      if (falha) throw falha.reason;
    })();
    return encerramento;
  }

  const sinais = ["SIGINT", "SIGTERM"].map((sinal) => {
    const handler = () => {
      encerrar()
        .catch(console.error)
        .finally(() => process.exit(sinal === "SIGINT" ? 130 : 143));
    };
    process.once(sinal, handler);
    return [sinal, handler];
  });

  return {
    portaLivre,
    iniciar,
    rodar,
    esperar,
    criarTemporario,
    criarBanco,
    encerrarProcesso,
    subir,
    iniciarApi,
    iniciarVite,
    subirAmbiente,
    registrar,
    abrirNavegador,
    encerrar,
  };
}

module.exports = { criarApoio };
