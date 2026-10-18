import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { listarProjetos } from "../api";
import { useConsulta } from "../hooks/useConsulta";
import type { NovaTarefa, Prioridade, Status } from "../tipos";
import "./FormularioTarefa.css";

const opcoesStatus: { valor: Status; texto: string }[] = [
  { valor: "a-fazer", texto: "A fazer" },
  { valor: "em-andamento", texto: "Em andamento" },
  { valor: "em-revisao", texto: "Em revisão" },
  { valor: "concluida", texto: "Concluída" },
];

const opcoesPrioridade: { valor: Prioridade; texto: string }[] = [
  { valor: "baixa", texto: "Baixa" },
  { valor: "media", texto: "Média" },
  { valor: "alta", texto: "Alta" },
];

type CampoObrigatorio = "projetoId" | "titulo" | "responsavel" | "prazo";
type ErrosCampos = Partial<Record<CampoObrigatorio, string>>;

interface FormularioTarefaProps {
  /** Lido apenas na montagem; use `key` no pai para trocar a tarefa editada. */
  valoresIniciais?: Partial<NovaTarefa>;
  onSalvar: (dados: NovaTarefa) => void | Promise<void>;
  onCancelar?: () => void;
  textoSalvar?: string;
}

export function FormularioTarefa({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar tarefa",
}: FormularioTarefaProps) {
  const id = useId();
  const projetos = useConsulta(listarProjetos);

  const [projetoId, setProjetoId] = useState(valoresIniciais?.projetoId ?? "");
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [status, setStatus] = useState<Status>(valoresIniciais?.status ?? "a-fazer");
  const [prioridade, setPrioridade] = useState<Prioridade>(
    valoresIniciais?.prioridade ?? "media",
  );
  const [responsavel, setResponsavel] = useState(valoresIniciais?.responsavel ?? "");
  const [prazo, setPrazo] = useState(valoresIniciais?.prazo ?? "");

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);

  const listaProjetos = projetos.dados ?? [];
  const projetosDisponiveis = listaProjetos.length > 0;
  const projetoDesconhecido =
    projetoId !== "" && projetosDisponiveis && !listaProjetos.some((p) => p.id === projetoId);
  const podeSalvar = projetosDisponiveis && !projetoDesconhecido;
  const avisoProjeto = !podeSalvar || projetoDesconhecido ? `${id}-projeto-aviso` : undefined;

  function limparErro(campo: CampoObrigatorio) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const seguintes = { ...atuais };
      delete seguintes[campo];
      return seguintes;
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || !podeSalvar) return;

    const novosErros: ErrosCampos = {};
    if (!projetoId) novosErros.projetoId = "Selecione um projeto.";
    else if (projetoDesconhecido) novosErros.projetoId = "Escolha um projeto disponível.";
    if (!titulo.trim()) novosErros.titulo = "Informe o título da tarefa.";
    if (!responsavel.trim()) novosErros.responsavel = "Informe o responsável.";
    if (!prazo) novosErros.prazo = "Informe o prazo.";
    setErros(novosErros);
    const primeiroErro = Object.keys(novosErros)[0] as CampoObrigatorio | undefined;
    if (primeiroErro) {
      const formulario = evento.currentTarget;
      window.setTimeout(() => formulario.querySelector<HTMLElement>(`[name="${primeiroErro}"]`)?.focus(), 0);
      return;
    }

    // Monta o objeto campo a campo para nunca repassar `id` ou extras.
    const dados: NovaTarefa = {
      projetoId,
      titulo,
      descricao,
      status,
      prioridade,
      responsavel,
      prazo,
    };

    enviandoRef.current = true;
    setEnviando(true);
    setErroEnvio(false);
    try {
      await onSalvar(dados);
    } catch {
      setErroEnvio(true);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <form className="formulario-tarefa" onSubmit={enviar} noValidate aria-busy={enviando}>
      <div className="formulario-tarefa__campo formulario-tarefa__campo--largo">
        <label htmlFor={`${id}-projeto`}>Projeto</label>
        <select
          id={`${id}-projeto`}
          name="projetoId"
          required
          value={projetoId}
          onChange={(e) => { setProjetoId(e.target.value); limparErro("projetoId"); }}
          disabled={!projetosDisponiveis}
          aria-invalid={Boolean(erros.projetoId || projetoDesconhecido)}
          aria-describedby={[avisoProjeto, erros.projetoId && `${id}-projeto-erro`].filter(Boolean).join(" ") || undefined}
        >
          <option value="" disabled>
            Selecione um projeto
          </option>
          {projetoDesconhecido && (
            <option value={projetoId} disabled>
              Projeto não encontrado
            </option>
          )}
          {listaProjetos.map((projeto) => (
            <option key={projeto.id} value={projeto.id}>
              {projeto.nome}
            </option>
          ))}
        </select>
        {erros.projetoId && <p id={`${id}-projeto-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">{erros.projetoId}</p>}
        {projetoDesconhecido && (
          <p id={`${id}-projeto-aviso`} className="formulario-tarefa__aviso" role="status">
            O projeto desta tarefa não foi encontrado. Escolha um projeto disponível.
          </p>
        )}
        {projetos.carregando && (
          <p id={`${id}-projeto-aviso`} className="formulario-tarefa__aviso" role="status">
            Carregando projetos…
          </p>
        )}
        {projetos.erro !== undefined && (
          <p
            id={`${id}-projeto-aviso`}
            className="formulario-tarefa__aviso formulario-tarefa__aviso--erro"
            role="alert"
          >
            Não foi possível carregar os projetos. Recarregue a página para tentar novamente.
          </p>
        )}
        {projetos.dados && !projetosDisponiveis && (
          <p id={`${id}-projeto-aviso`} className="formulario-tarefa__aviso" role="status">
            Nenhum projeto cadastrado. Crie um projeto antes de salvar a tarefa.
          </p>
        )}
      </div>

      <div className="formulario-tarefa__campo formulario-tarefa__campo--largo">
        <label htmlFor={`${id}-titulo`}>Título</label>
        <input
          id={`${id}-titulo`}
          name="titulo"
          type="text"
          required
          aria-invalid={Boolean(erros.titulo)}
          aria-describedby={erros.titulo ? `${id}-titulo-erro` : undefined}
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); limparErro("titulo"); }}
        />
        {erros.titulo && <p id={`${id}-titulo-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">{erros.titulo}</p>}
      </div>

      <div className="formulario-tarefa__campo formulario-tarefa__campo--largo">
        <label htmlFor={`${id}-descricao`}>Descrição</label>
        <textarea
          id={`${id}-descricao`}
          name="descricao"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <div className="formulario-tarefa__campo">
        <label htmlFor={`${id}-status`}>Status</label>
        <select
          id={`${id}-status`}
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
        >
          {opcoesStatus.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.texto}
            </option>
          ))}
        </select>
      </div>

      <div className="formulario-tarefa__campo">
        <label htmlFor={`${id}-prioridade`}>Prioridade</label>
        <select
          id={`${id}-prioridade`}
          name="prioridade"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value as Prioridade)}
        >
          {opcoesPrioridade.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.texto}
            </option>
          ))}
        </select>
      </div>

      <div className="formulario-tarefa__campo">
        <label htmlFor={`${id}-responsavel`}>Responsável</label>
        <input
          id={`${id}-responsavel`}
          name="responsavel"
          type="text"
          required
          aria-invalid={Boolean(erros.responsavel)}
          aria-describedby={erros.responsavel ? `${id}-responsavel-erro` : undefined}
          value={responsavel}
          onChange={(e) => { setResponsavel(e.target.value); limparErro("responsavel"); }}
        />
        {erros.responsavel && <p id={`${id}-responsavel-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">{erros.responsavel}</p>}
      </div>

      <div className="formulario-tarefa__campo">
        <label htmlFor={`${id}-prazo`}>Prazo</label>
        <input
          id={`${id}-prazo`}
          name="prazo"
          type="date"
          required
          aria-invalid={Boolean(erros.prazo)}
          aria-describedby={erros.prazo ? `${id}-prazo-erro` : undefined}
          value={prazo}
          onChange={(e) => { setPrazo(e.target.value); limparErro("prazo"); }}
        />
        {erros.prazo && <p id={`${id}-prazo-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">{erros.prazo}</p>}
      </div>

      {erroEnvio && (
        <p className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">
          Não foi possível salvar a tarefa. Seus dados foram mantidos; tente novamente.
        </p>
      )}

      <div className="formulario-tarefa__acoes">
        <button
          type="submit"
          className="formulario-tarefa__botao formulario-tarefa__botao--principal"
          disabled={enviando || !podeSalvar}
        >
          {enviando ? "Salvando…" : textoSalvar}
        </button>
        {onCancelar && (
          <button
            type="button"
            className="formulario-tarefa__botao"
            onClick={onCancelar}
            disabled={enviando}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
