import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button as BotaoAria } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { ErroApi } from "../api";
import { dataValida } from "../design/formatos";
import { Icon } from "../design/icon";
import type { Projeto } from "../tipos";
import { PrazoNovaTarefa } from "./PrazoNovaTarefa";
import "./FormularioTarefa.css";

export type DadosProjeto = Omit<Projeto, "id">;

type CampoObrigatorio = "nome" | "disciplina" | "criadoEm";
type ErrosCampos = Partial<Record<CampoObrigatorio, string>>;

const IconeDisciplina = (props: Omit<Parameters<typeof Icon>[0], "name">) => (
  <Icon {...props} name="book" />
);

interface FormularioProjetoProps {
  valoresIniciais?: Partial<DadosProjeto>;
  onSalvar: (dados: DadosProjeto) => void | Promise<void>;
  onCancelar?: () => void;
  textoSalvar?: string;
  onEstadoEnvio?: (ocupada: boolean) => void;
  onAlteracao?: (alterado: boolean) => void;
  edicao?: boolean;
}

export function FormularioProjeto({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar projeto",
  onEstadoEnvio,
  onAlteracao,
  edicao = false,
}: FormularioProjetoProps) {
  const id = useId();
  const [nome, setNome] = useState(valoresIniciais?.nome ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [disciplina, setDisciplina] = useState(
    valoresIniciais?.disciplina ?? "",
  );
  const [criadoEm, setCriadoEm] = useState(valoresIniciais?.criadoEm ?? "");
  const [iniciais] = useState(valoresIniciais);
  const alterado =
    nome !== (iniciais?.nome ?? "") ||
    descricao !== (iniciais?.descricao ?? "") ||
    disciplina !== (iniciais?.disciplina ?? "") ||
    criadoEm !== (iniciais?.criadoEm ?? "");
  const [descricaoAberta, setDescricaoAberta] = useState(
    Boolean(valoresIniciais?.descricao),
  );
  const [focarDescricao, setFocarDescricao] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<false | "falha" | "inexistente">(
    false,
  );
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);

  const onEstadoEnvioRef = useRef(onEstadoEnvio);
  const onAlteracaoRef = useRef(onAlteracao);
  const notificadoRef = useRef(false);
  useEffect(() => {
    onEstadoEnvioRef.current = onEstadoEnvio;
    onAlteracaoRef.current = onAlteracao;
  });
  useEffect(() => {
    if (!alterado) return;
    onAlteracaoRef.current?.(true);
    return () => onAlteracaoRef.current?.(false);
  }, [alterado]);
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
    else if (!dataValida(criadoEm))
      novosErros.criadoEm = "Informe uma data válida.";
    setErros(novosErros);
    const primeiroErro = Object.keys(novosErros)[0] as
      CampoObrigatorio | undefined;
    if (primeiroErro) {
      const formulario = evento.currentTarget;
      window.setTimeout(
        () =>
          formulario
            .querySelector<HTMLElement>(
              primeiroErro === "criadoEm"
                ? "[data-prazo-atalho]"
                : `[name="${primeiroErro}"]`,
            )
            ?.focus(),
        0,
      );
      return;
    }

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
    } catch (erro) {
      setErroEnvio(
        edicao && erro instanceof ErroApi && erro.status === 404
          ? "inexistente"
          : "falha",
      );
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      notificarEnvio(false);
    }
  }

  const rotuloDescricao = descricaoAberta
    ? "Ocultar descrição"
    : descricao.trim()
      ? "Mostrar descrição"
      : "Adicionar descrição";

  return (
    <form
      id={id}
      className="e-project-form formulario-tarefa"
      onSubmit={enviar}
      noValidate
      aria-busy={enviando}
    >
      <div className="e-panel-scroll">
        <div className="e-title-field">
          <Input
            name="nome"
            label="Nome"
            placeholder="Nome do projeto"
            autoFocus
            isRequired
            validationBehavior="aria"
            size="md"
            value={nome}
            onChange={(valor) => {
              setNome(valor);
              limparErro("nome");
            }}
            isInvalid={Boolean(erros.nome)}
            hint={
              erros.nome ? <span role="alert">{erros.nome}</span> : undefined
            }
          />
        </div>

        <div className="e-tarefa-compacta">
          <div className="e-tarefa-responsavel">
            <Input
              name="disciplina"
              label="Disciplina"
              placeholder="Disciplina"
              size="sm"
              icon={IconeDisciplina}
              isRequired
              validationBehavior="aria"
              value={disciplina}
              onChange={(valor) => {
                setDisciplina(valor);
                limparErro("disciplina");
              }}
              isInvalid={Boolean(erros.disciplina)}
              hint={
                erros.disciplina ? (
                  <span role="alert">{erros.disciplina}</span>
                ) : undefined
              }
            />
          </div>
          <div className="e-tarefa-avisos">
            {erros.criadoEm && (
              <p
                id={`${id}-criado-erro`}
                className="formulario-tarefa__aviso formulario-tarefa__aviso--erro"
                role="alert"
              >
                {erros.criadoEm}
              </p>
            )}
          </div>
          {descricaoAberta && (
            <div id={`${id}-descricao`} className="e-description-body">
              <TextArea
                name="descricao"
                label="Descrição"
                placeholder="Descrição (opcional)"
                rows={3}
                size="sm"
                autoFocus={focarDescricao}
                value={descricao}
                onChange={setDescricao}
              />
            </div>
          )}
        </div>
      </div>

      {erroEnvio && (
        <div className="e-form-error" role="alert">
          <Icon name="exclamation" />
          {erroEnvio === "inexistente"
            ? "Este projeto não existe mais. Ele pode ter sido excluído; seus dados foram mantidos."
            : "Não foi possível salvar o projeto. Seus dados foram mantidos; tente de novo."}
        </div>
      )}

      <div className="e-form-footer e-tarefa-rodape">
        <div
          className="e-tarefa-atalhos"
          role="group"
          aria-label="Detalhes do projeto"
        >
          <PrazoNovaTarefa
            valor={criadoEm}
            erro={erros.criadoEm}
            onChange={(valor) => {
              setCriadoEm(valor);
              limparErro("criadoEm");
            }}
            formulario={id}
            idErro={`${id}-criado-erro`}
            nome="criadoEm"
            rotulo="Criado em"
            alvo="data de criação"
            doAlvo="da data de criação"
          />
          <Tooltip title={rotuloDescricao}>
            <BotaoAria
              type="button"
              className="e-description-toggle e-tarefa-atalho"
              data-preenchido={descricao.trim() ? "" : undefined}
              aria-label={rotuloDescricao}
              aria-expanded={descricaoAberta}
              aria-controls={descricaoAberta ? `${id}-descricao` : undefined}
              onPress={() => {
                setDescricaoAberta(!descricaoAberta);
                setFocarDescricao(!descricaoAberta);
              }}
            >
              <Icon name="document" />
            </BotaoAria>
          </Tooltip>
        </div>
        <div className="e-tarefa-envio">
          {onCancelar && (
            <Button
              type="button"
              color="tertiary"
              size="sm"
              onClick={onCancelar}
              isDisabled={enviando}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" color="primary" size="sm" isDisabled={enviando}>
            {enviando ? "Salvando…" : textoSalvar}
          </Button>
        </div>
      </div>
    </form>
  );
}
