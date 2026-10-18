import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { atualizarProjeto, criarProjeto, listarProjetos } from "../api";
import { FormularioProjeto } from "../components/FormularioProjeto";
import type { DadosProjeto } from "../components/FormularioProjeto";
import type { Projeto } from "../tipos";

function mesmoConteudo(projeto: Projeto, dados: DadosProjeto) {
  return (
    projeto.nome === dados.nome &&
    projeto.descricao === dados.descricao &&
    projeto.disciplina === dados.disciplina &&
    projeto.criadoEm === dados.criadoEm
  );
}

export function NovoProjeto() {
  const navigate = useNavigate();
  const controllerRef = useRef<AbortController | null>(null);
  // A API gera o `id` no POST. Se a resposta se perder, o projeto pode ter sido
  // gravado mesmo assim; estes registros permitem localizar esse cadastro antes
  // de enviar outro POST e evitar projetos duplicados.
  const idsAnterioresRef = useRef<Set<string> | null>(null);
  const tentativasRef = useRef<DadosProjeto[]>([]);

  // Ao sair da página, o envio pendente é cancelado e a resposta tardia não redireciona.
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);

  async function localizarGravado(signal: AbortSignal) {
    const idsAnteriores = idsAnterioresRef.current;
    if (!idsAnteriores) return undefined;
    const projetos = await listarProjetos(signal);
    return projetos.find(
      (projeto) =>
        !idsAnteriores.has(projeto.id) &&
        tentativasRef.current.some((tentativa) => mesmoConteudo(projeto, tentativa)),
    );
  }

  async function salvar(dados: DadosProjeto) {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;
    const { signal } = controller;

    if (!idsAnterioresRef.current) {
      const atuais = await listarProjetos(signal);
      idsAnterioresRef.current = new Set(atuais.map((projeto) => projeto.id));
    }

    const houveFalha = tentativasRef.current.length > 0;
    tentativasRef.current.push(dados);
    const gravadoAntes = houveFalha ? await localizarGravado(signal) : undefined;

    if (gravadoAntes) {
      // Uma tentativa anterior foi gravada: reaproveita o registro em vez de criar outro.
      if (!mesmoConteudo(gravadoAntes, dados)) await atualizarProjeto(gravadoAntes.id, dados, signal);
    } else {
      try {
        await criarProjeto(dados, signal);
      } catch (erro) {
        if (signal.aborted) throw erro;
        // Sem confirmação, verifica se o servidor gravou antes de liberar nova tentativa.
        const gravado = await localizarGravado(signal).catch(() => undefined);
        if (!gravado) throw erro;
      }
    }

    if (!signal.aborted) navigate("/projetos");
  }

  return (
    <main className="pagina-tarefas">
      <header className="pagina-tarefas__cabecalho">
        <Link to="/projetos">Voltar para projetos</Link>
        <h1>Novo projeto</h1>
      </header>
      <FormularioProjeto
        onSalvar={salvar}
        onCancelar={() => navigate("/projetos")}
      />
    </main>
  );
}
