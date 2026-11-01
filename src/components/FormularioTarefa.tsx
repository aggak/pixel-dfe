import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { listarProjetos } from "../api";
import { FolderIcon, Icon, RefreshIcon } from "../design/icon";
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

// Ordem em que os campos aparecem na ficha: o foco de erro vai para o primeiro inválido nesta ordem.
const ordemCampos: CampoObrigatorio[] = ["titulo", "projetoId", "responsavel", "prazo"];

interface FormularioTarefaProps {
  /** Lido apenas na montagem; use `key` no pai para trocar a tarefa editada. */
  valoresIniciais?: Partial<NovaTarefa>;
  onSalvar: (dados: NovaTarefa) => void | Promise<void>;
  onCancelar?: () => void;
  textoSalvar?: string;
  /** Avisa o pai quando um envio começa (`true`) e quando termina ou o formulário é desmontado (`false`). */
  onEstadoEnvio?: (ocupada: boolean) => void;
}

export function FormularioTarefa({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar tarefa",
  onEstadoEnvio,
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
  // A descrição já preenchida começa visível; recolher apenas esconde o campo, o valor fica no estado.
  const [descricaoAberta, setDescricaoAberta] = useState(Boolean(valoresIniciais?.descricao));

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);
  const seletorProjetoRef = useRef<HTMLDivElement>(null);

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

  const listaProjetos = projetos.dados ?? [];
  const projetosDisponiveis = listaProjetos.length > 0;
  const projetoDesconhecido =
    projetoId !== "" && projetosDisponiveis && !listaProjetos.some((p) => p.id === projetoId);
  const podeSalvar = projetosDisponiveis && !projetoDesconhecido;
  const avisoProjeto = !podeSalvar || projetoDesconhecido ? `${id}-projeto-aviso` : undefined;

  const itensProjeto = [
    ...(projetoDesconhecido ? [{ id: projetoId, label: "Projeto não encontrado" }] : []),
    ...listaProjetos.map((projeto) => ({ id: projeto.id, label: projeto.nome })),
  ];
  const itensStatus = opcoesStatus.map((opcao) => ({ id: opcao.valor, label: opcao.texto }));
  const itensPrioridade = opcoesPrioridade.map((opcao) => ({ id: opcao.valor, label: opcao.texto }));

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
    const primeiroErro = ordemCampos.find((campo) => novosErros[campo]);
    if (primeiroErro) {
      const formulario = evento.currentTarget;
      window.setTimeout(() => {
        // O `name` do Select real fica no <select> oculto; o foco vai para o botão do combobox.
        const alvo =
          primeiroErro === "projetoId"
            ? seletorProjetoRef.current?.querySelector<HTMLElement>("button")
            : formulario.querySelector<HTMLElement>(`[name="${primeiroErro}"]`);
        alvo?.focus();
      }, 0);
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
    <form className="e-task-form formulario-tarefa" onSubmit={enviar} noValidate aria-busy={enviando}>
      <div className="e-panel-scroll">
        <div className="e-title-field">
          <Input
            name="titulo"
            label="Título"
            placeholder="O que precisa ser feito?"
            autoFocus
            isRequired
            validationBehavior="aria"
            size="md"
            value={titulo}
            onChange={(valor) => { setTitulo(valor); limparErro("titulo"); }}
            isInvalid={Boolean(erros.titulo)}
            hint={erros.titulo ? <span role="alert">{erros.titulo}</span> : undefined}
          />
        </div>

        <div className="e-properties">
          <div className="formulario-tarefa__projeto">
            <Select
              ref={seletorProjetoRef}
              name="projetoId"
              label="Projeto"
              icon={FolderIcon}
              placeholder="Selecione um projeto"
              size="sm"
              isRequired
              validationBehavior="aria"
              items={itensProjeto}
              selectedKey={projetoId || null}
              disabledKeys={projetoDesconhecido ? [projetoId] : undefined}
              onSelectionChange={(chave) => {
                setProjetoId(chave === null ? "" : String(chave));
                limparErro("projetoId");
              }}
              isDisabled={!projetosDisponiveis}
              isInvalid={Boolean(erros.projetoId || projetoDesconhecido)}
              aria-describedby={[avisoProjeto, erros.projetoId && `${id}-projeto-erro`].filter(Boolean).join(" ") || undefined}
            >
              {(item) => (
                <Select.Item id={item.id} textValue={item.label}>
                  {item.label}
                </Select.Item>
              )}
            </Select>
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
                className="formulario-tarefa__aviso formulario-tarefa__aviso--erro formulario-tarefa__aviso--acao"
                role="alert"
              >
                <Icon name="cloud-disabled" />
                {projetos.tentando ? "Tentando de novo…" : "Não foi possível carregar os projetos."}
                <Button type="button" color="link-color" size="sm" iconLeading={RefreshIcon} isLoading={projetos.tentando} showTextWhileLoading onClick={projetos.tentarDeNovo}>
                  Tentar de novo
                </Button>
              </p>
            )}
            {projetos.dados && !projetosDisponiveis && (
              <p id={`${id}-projeto-aviso`} className="formulario-tarefa__aviso" role="status">
                Nenhum projeto cadastrado. Crie um projeto antes de salvar a tarefa.
              </p>
            )}
          </div>

          <div className="e-form-two e-person-date">
            <Input
              name="responsavel"
              label="Responsável"
              placeholder="Nome"
              size="sm"
              isRequired
              validationBehavior="aria"
              value={responsavel}
              onChange={(valor) => { setResponsavel(valor); limparErro("responsavel"); }}
              isInvalid={Boolean(erros.responsavel)}
              hint={erros.responsavel ? <span role="alert">{erros.responsavel}</span> : undefined}
            />
            <Input
              name="prazo"
              label="Prazo"
              type="date"
              size="sm"
              isRequired
              validationBehavior="aria"
              value={prazo}
              onChange={(valor) => { setPrazo(valor); limparErro("prazo"); }}
              isInvalid={Boolean(erros.prazo)}
              hint={erros.prazo ? <span role="alert">{erros.prazo}</span> : undefined}
            />
          </div>

          <div className="e-form-two">
            <Select
              name="status"
              label="Status"
              isRequired
              validationBehavior="aria"
              size="sm"
              items={itensStatus}
              selectedKey={status}
              onSelectionChange={(chave) => {
                const opcao = opcoesStatus.find((o) => o.valor === chave);
                if (opcao) setStatus(opcao.valor);
              }}
            >
              {(item) => (
                <Select.Item id={item.id} textValue={item.label}>
                  {item.label}
                </Select.Item>
              )}
            </Select>
            <Select
              name="prioridade"
              label="Prioridade"
              isRequired
              validationBehavior="aria"
              size="sm"
              items={itensPrioridade}
              selectedKey={prioridade}
              onSelectionChange={(chave) => {
                const opcao = opcoesPrioridade.find((o) => o.valor === chave);
                if (opcao) setPrioridade(opcao.valor);
              }}
            >
              {(item) => (
                <Select.Item id={item.id} textValue={item.label}>
                  {item.label}
                </Select.Item>
              )}
            </Select>
          </div>
        </div>

        <div className="e-description">
          <button
            type="button"
            className="e-description-toggle"
            aria-expanded={descricaoAberta}
            aria-controls={descricaoAberta ? `${id}-descricao` : undefined}
            onClick={() => setDescricaoAberta((aberta) => !aberta)}
          >
            <Icon name={descricaoAberta ? "minus-small" : "plus-small"} />
            {descricaoAberta ? "Descrição" : "Adicionar descrição"}
            <span>opcional</span>
          </button>
          {descricaoAberta && (
            <div id={`${id}-descricao`} className="e-description-body">
              <TextArea
                name="descricao"
                label="Descrição"
                placeholder="Contexto, referências ou o que precisa ser entregue…"
                rows={3}
                size="sm"
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
          Não foi possível salvar a tarefa. Seus dados foram mantidos; tente novamente.
        </div>
      )}

      <div className="e-form-footer">
        {onCancelar && (
          <Button type="button" color="tertiary" size="sm" onClick={onCancelar} isDisabled={enviando}>
            Cancelar
          </Button>
        )}
        <Button type="submit" color="primary" size="sm" isDisabled={enviando || !podeSalvar}>
          {enviando ? "Salvando…" : textoSalvar}
        </Button>
      </div>
    </form>
  );
}
