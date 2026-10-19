import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Icon } from "../design/icon";
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
  /** Avisa o pai quando um envio começa (`true`) e quando termina ou o formulário é desmontado (`false`). */
  onEstadoEnvio?: (ocupada: boolean) => void;
}

export function FormularioProjeto({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar projeto",
  onEstadoEnvio,
}: FormularioProjetoProps) {
  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [disciplina, setDisciplina] = useState(valoresIniciais?.disciplina ?? "");
  const [criadoEm, setCriadoEm] = useState(valoresIniciais?.criadoEm ?? "");

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);

  const onEstadoEnvioRef = useRef(onEstadoEnvio);
  const notificadoRef = useRef(false);
  useEffect(() => {
    onEstadoEnvioRef.current = onEstadoEnvio;
  });
  // Se o formulário sair da tela durante um envio, o pai não pode ficar preso em "ocupada".
  useEffect(
    () => () => {
      if (!notificadoRef.current) return;
      notificadoRef.current = false;
      onEstadoEnvioRef.current?.(false);
    },
    [],
  );

  function notificarEnvio(ocupada: boolean) {
    if (notificadoRef.current === ocupada) return;
    notificadoRef.current = ocupada;
    onEstadoEnvioRef.current?.(ocupada);
  }

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
    // A ordem de inserção acima é a ordem dos campos na ficha (nome, disciplina, criado em).
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
    notificarEnvio(true);
    try {
      await onSalvar(dados);
    } catch {
      setErroEnvio(true);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      notificarEnvio(false);
    }
  }

  return (
    <form className="e-project-form formulario-tarefa" onSubmit={enviar} noValidate aria-busy={enviando}>
      <div className="e-panel-scroll">
        <div className="e-project-fields">
          <Input
            name="nome"
            label="Nome"
            placeholder="Nome do projeto"
            autoFocus
            isRequired
            validationBehavior="aria"
            size="sm"
            value={nome}
            onChange={(valor) => { setNome(valor); limparErro("nome"); }}
            isInvalid={Boolean(erros.nome)}
            hint={erros.nome ? <span role="alert">{erros.nome}</span> : undefined}
          />

          <div className="e-form-two">
            <Input
              name="disciplina"
              label="Disciplina"
              placeholder="Disciplina"
              isRequired
              validationBehavior="aria"
              size="sm"
              value={disciplina}
              onChange={(valor) => { setDisciplina(valor); limparErro("disciplina"); }}
              isInvalid={Boolean(erros.disciplina)}
              hint={erros.disciplina ? <span role="alert">{erros.disciplina}</span> : undefined}
            />
            {/* Mantido visível, editável e obrigatório: faz parte dos dados do projeto. */}
            <Input
              name="criadoEm"
              label="Criado em"
              type="date"
              isRequired
              validationBehavior="aria"
              size="sm"
              value={criadoEm}
              onChange={(valor) => { setCriadoEm(valor); limparErro("criadoEm"); }}
              isInvalid={Boolean(erros.criadoEm)}
              hint={erros.criadoEm ? <span role="alert">{erros.criadoEm}</span> : undefined}
            />
          </div>

          <TextArea
            name="descricao"
            label="Descrição"
            placeholder="O que este projeto reúne?"
            rows={3}
            size="sm"
            value={descricao}
            onChange={setDescricao}
          />
        </div>
      </div>

      {erroEnvio && (
        <div className="e-form-error" role="alert">
          <Icon name="exclamation" />
          Não foi possível salvar o projeto. Seus dados foram mantidos; tente novamente.
        </div>
      )}

      <div className="e-form-footer">
        {onCancelar && (
          <Button type="button" color="tertiary" size="sm" onClick={onCancelar} isDisabled={enviando}>
            Cancelar
          </Button>
        )}
        <Button type="submit" color="primary" size="sm" isDisabled={enviando}>
          {enviando ? "Salvando…" : textoSalvar}
        </Button>
      </div>
    </form>
  );
}
