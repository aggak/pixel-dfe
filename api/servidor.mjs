import { watchFile } from "node:fs";
import { parseArgs } from "node:util";
import { App } from "@tinyhttp/app";
import { createApp } from "json-server/lib/app.js";
import {
  DEFAULT_SCHEMA_PATH,
  NormalizedAdapter,
} from "json-server/lib/adapters/normalized-adapter.js";
import { randomId } from "json-server/lib/random-id.js";
import { isItem } from "json-server/lib/service.js";
import { JSONFileSync } from "lowdb/node";
import { json } from "milliparsec";
import {
  LIMITE_PROJETOS,
  MENSAGEM_LIMITE_PROJETOS,
} from "../src/limite-projetos.ts";

const producao = process.env.NODE_ENV === "production";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: "string", short: "p", default: process.env.PORT || "3000" },
    host: {
      type: "string",
      short: "h",
      default: process.env.HOST || "0.0.0.0",
    },
  },
});
const caminho = positionals[0] ?? "db.json";
const arquivo = new JSONFileSync(caminho);
const normalizado = new NormalizedAdapter(arquivo);
const dados = await normalizado.read();
if (!dados) throw new Error(`Banco de dados não encontrado em ${caminho}.`);

function gravar(dados) {
  arquivo.write({ ...dados, $schema: DEFAULT_SCHEMA_PATH });
}

const banco = {
  data: dados,
  write() {
    gravar(this.data);
  },
};

const servidor = new App();
const lerJson = json();
servidor.post("/:name", (req, res, next) => {
  if (req.params.name !== "projetos") return next();

  res.setHeader("Access-Control-Allow-Origin", "*");
  return lerJson(req, res, (erro) => {
    if (erro) return next(erro);
    if (!isItem(req.body)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const projetos = banco.data.projetos;
    if (!Array.isArray(projetos)) {
      return res.status(404).json({ error: "Not Found" });
    }
    if (projetos.length >= LIMITE_PROJETOS) {
      return res.status(409).json({ error: MENSAGEM_LIMITE_PROJETOS });
    }

    const projeto = { ...req.body, id: randomId() };
    const novosDados = { ...banco.data, projetos: [...projetos, projeto] };
    try {
      gravar(novosDados);
    } catch (erro) {
      return next(erro);
    }
    banco.data = novosDados;
    return res.status(201).json(projeto);
  });
});
servidor.use(createApp(banco));

servidor.listen(
  Number(values.port),
  () => {
    console.log(`API Pixel em http://${values.host}:${values.port}`);
  },
  values.host,
);

if (!producao) {
  watchFile(caminho, { interval: 500 }, async () => {
    try {
      const dadosAtualizados = await normalizado.read();
      if (dadosAtualizados) banco.data = dadosAtualizados;
    } catch (erro) {
      console.error(`Não foi possível reler ${caminho}.`, erro);
    }
  });
}
