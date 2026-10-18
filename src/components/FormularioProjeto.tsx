import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Projeto } from "../tipos";
import "./FormularioTarefa.css";

export type DadosProjeto = Omit<Projeto, "id">;

type CampoObrigatorio = "nome" | "disciplina" | "criadoEm";
type ErrosCampos = Partial<Record<CampoObrigatorio, string>>;

interface FormularioProjetoProps {
  /** Lido apenas na montagem; use `key` no pai para trocar o projeto editado. */
  valoresIniciais?: Partial<DadosProjeto>;
  onSalvar: (dados: DadosProjeto) => void | Promise<void>;
  onCancelar?: () => void;
  textoSalvar?: string;
}

export function FormularioProjeto({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar projeto",
}: FormularioProjetoProps) {
  const id = useId();

  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [disciplina, setDisciplina] = useState(valoresIniciais?.disciplina ?? "");
  const [criadoEm, setCriadoEm] = useState(valoresIniciais?.criadoEm ?? "");

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);

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
    if (enviandoRef.current) return;

    const novosErros: ErrosCampos = {};
    if (!nome.trim()) novosErros.nome = "Informe o nome do projeto.";
    if (!disciplina.trim()) novosErros.disciplina = "Informe a disciplina.";
    if (!criadoEm) novosErros.criadoEm = "Informe a data de criação.";
    setErros(novosErros);
    const primeiroErro = Object.keys(novosErros)[0] as CampoObrigatorio | undefined;
    if (primeiroErro) {
      const formulario = evento.currentTarget;
      window.setTimeout(() => formulario.querySelector<HTMLElement>(`[name="${primeiroErro}"]`)?.focus(), 0);
      return;
    }

    // Monta o objeto campo a campo para nunca repassar `id` ou extras.
    // Nome e disciplina são validados sem espaços nas pontas e gravados da mesma forma.
    const dados: DadosProjeto = {
      nome: nome.trim(),
      descricao,
      disciplina: disciplina.trim(),
      criadoEm,
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
        <label htmlFor={`${id}-nome`}>Nome</label>
        <input
          id={`${id}-nome`}
          name="nome"
          type="text"
          required
          aria-invalid={Boolean(erros.nome)}
          aria-describedby={erros.nome ? `${id}-nome-erro` : undefined}
          value={nome}
          onChange={(e) => { setNome(e.target.value); limparErro("nome"); }}
        />
        {erros.nome && (
          <p id={`${id}-nome-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">
            {erros.nome}
          </p>
        )}
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
        <label htmlFor={`${id}-disciplina`}>Disciplina</label>
        <input
          id={`${id}-disciplina`}
          name="disciplina"
          type="text"
          required
          aria-invalid={Boolean(erros.disciplina)}
          aria-describedby={erros.disciplina ? `${id}-disciplina-erro` : undefined}
          value={disciplina}
          onChange={(e) => { setDisciplina(e.target.value); limparErro("disciplina"); }}
        />
        {erros.disciplina && (
          <p id={`${id}-disciplina-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">
            {erros.disciplina}
          </p>
        )}
      </div>

      <div className="formulario-tarefa__campo">
        <label htmlFor={`${id}-criadoEm`}>Criado em</label>
        <input
          id={`${id}-criadoEm`}
          name="criadoEm"
          type="date"
          required
          aria-invalid={Boolean(erros.criadoEm)}
          aria-describedby={erros.criadoEm ? `${id}-criadoEm-erro` : undefined}
          value={criadoEm}
          onChange={(e) => { setCriadoEm(e.target.value); limparErro("criadoEm"); }}
        />
        {erros.criadoEm && (
          <p id={`${id}-criadoEm-erro`} className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">
            {erros.criadoEm}
          </p>
        )}
      </div>

      {erroEnvio && (
        <p className="formulario-tarefa__aviso formulario-tarefa__aviso--erro" role="alert">
          Não foi possível salvar o projeto. Seus dados foram mantidos; tente novamente.
        </p>
      )}

      <div className="formulario-tarefa__acoes">
        <button
          type="submit"
          className="formulario-tarefa__botao formulario-tarefa__botao--principal"
          disabled={enviando}
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
