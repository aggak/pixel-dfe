import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Button as BotaoAria } from "react-aria-components";
import { Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { TextArea } from "@/components/base/textarea/textarea";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { ErroApi, listarProjetos } from "../api";
import {
  dataValida,
  iconesPrioridade,
  prioridadeTexto,
  statusTexto,
} from "../design/formatos";
import { FolderIcon, Icon, RefreshIcon } from "../design/icon";
import { useConsulta } from "../hooks/useConsulta";
import type { NovaTarefa, Prioridade, Status } from "../tipos";
import { ContextoFicha } from "./ficha-contexto";
import { PrazoNovaTarefa } from "./PrazoNovaTarefa";
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

const iconesStatus: Record<Status, string> = {
  "a-fazer": "circle",
  "em-andamento": "play",
  "em-revisao": "eye",
  concluida: "check",
};

const IconeResponsavel = (props: Omit<Parameters<typeof Icon>[0], "name">) => (
  <Icon {...props} name="user" />
);

type CampoObrigatorio = "projetoId" | "titulo" | "responsavel" | "prazo";
type ErrosCampos = Partial<Record<CampoObrigatorio, string>>;

const ordemCampos: CampoObrigatorio[] = [
  "titulo",
  "projetoId",
  "responsavel",
  "prazo",
];

interface FormularioTarefaProps {
  valoresIniciais?: Partial<NovaTarefa>;
  onSalvar: (dados: NovaTarefa) => void | Promise<void>;
  onCancelar?: () => void;
  textoSalvar?: string;
  onEstadoEnvio?: (ocupada: boolean) => void;
  onAlteracao?: (alterado: boolean) => void;
  edicao?: boolean;
  compacto?: boolean;
}

export function FormularioTarefa({
  valoresIniciais,
  onSalvar,
  onCancelar,
  textoSalvar = "Salvar tarefa",
  onEstadoEnvio,
  onAlteracao,
  edicao = false,
  compacto = false,
}: FormularioTarefaProps) {
  const id = useId();
  const ficha = useContext(ContextoFicha);
  const projetos = useConsulta(listarProjetos);
  const classeOpcoes = compacto
    ? "e-nova-tarefa-popover e-nova-tarefa-opcoes"
    : undefined;

  const [projetoId, setProjetoId] = useState(valoresIniciais?.projetoId ?? "");
  const [titulo, setTitulo] = useState(valoresIniciais?.titulo ?? "");
  const [descricao, setDescricao] = useState(valoresIniciais?.descricao ?? "");
  const [status, setStatus] = useState<Status>(
    valoresIniciais?.status ?? "a-fazer",
  );
  const [prioridade, setPrioridade] = useState<Prioridade>(
    valoresIniciais?.prioridade ?? "media",
  );
  const [responsavel, setResponsavel] = useState(
    valoresIniciais?.responsavel ?? "",
  );
  const [prazo, setPrazo] = useState(valoresIniciais?.prazo ?? "");
  const [iniciais] = useState(valoresIniciais);
  const alterado =
    projetoId !== (iniciais?.projetoId ?? "") ||
    titulo !== (iniciais?.titulo ?? "") ||
    descricao !== (iniciais?.descricao ?? "") ||
    status !== (iniciais?.status ?? "a-fazer") ||
    prioridade !== (iniciais?.prioridade ?? "media") ||
    responsavel !== (iniciais?.responsavel ?? "") ||
    prazo !== (iniciais?.prazo ?? "");
  const [descricaoAberta, setDescricaoAberta] = useState(
    Boolean(valoresIniciais?.descricao),
  );
  // A descrição que já vem aberta não tira o foco inicial do título.
  const [focarDescricao, setFocarDescricao] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<false | "falha" | "inexistente">(
    false,
  );
  const [erros, setErros] = useState<ErrosCampos>({});
  const enviandoRef = useRef(false);
  const seletorProjetoRef = useRef<HTMLDivElement>(null);

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

  const listaProjetos = projetos.dados ?? [];
  const projetosDisponiveis = listaProjetos.length > 0;
  const projetoDesconhecido =
    projetoId !== "" &&
    projetosDisponiveis &&
    !listaProjetos.some((p) => p.id === projetoId);
  const podeSalvar = projetosDisponiveis && !projetoDesconhecido;
  const avisoProjeto =
    !podeSalvar || projetoDesconhecido ? `${id}-projeto-aviso` : undefined;

  useLayoutEffect(() => {
    const botao = seletorProjetoRef.current?.querySelector("button");
    if (erros.projetoId || projetoDesconhecido)
      botao?.setAttribute("aria-invalid", "true");
    else botao?.removeAttribute("aria-invalid");
  }, [erros.projetoId, projetoDesconhecido]);

  const itensProjeto = [
    ...(projetoDesconhecido
      ? [{ id: projetoId, label: "Projeto não encontrado" }]
      : []),
    ...listaProjetos.map((projeto) => ({
      id: projeto.id,
      label: projeto.nome,
    })),
  ];
  const itensStatus = opcoesStatus.map((opcao) => ({
    id: opcao.valor,
    label: opcao.texto,
  }));
  const itensPrioridade = opcoesPrioridade.map((opcao) => ({
    id: opcao.valor,
    label: opcao.texto,
  }));

  function limparErro(campo: CampoObrigatorio) {
    setErros((atuais) => {
      if (!atuais[campo]) return atuais;
      const seguintes = { ...atuais };
      delete seguintes[campo];
      return seguintes;
    });
  }

  function mudarPrazo(valor: string) {
    setPrazo(valor);
    limparErro("prazo");
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || !podeSalvar) return;

    const novosErros: ErrosCampos = {};
    if (!projetoId) novosErros.projetoId = "Selecione um projeto.";
    else if (projetoDesconhecido)
      novosErros.projetoId = "Escolha um projeto disponível.";
    if (!titulo.trim())
      novosErros.titulo = compacto
        ? "Informe o título."
        : "Informe o título da tarefa.";
    if (!responsavel.trim()) novosErros.responsavel = "Informe o responsável.";
    if (!prazo) novosErros.prazo = "Informe o prazo.";
    else if (!dataValida(prazo)) novosErros.prazo = "Informe uma data válida.";
    setErros(novosErros);
    const primeiroErro = ordemCampos.find((campo) => novosErros[campo]);
    if (primeiroErro) {
      const formulario = evento.currentTarget;
      window.setTimeout(() => {
        const alvo =
          primeiroErro === "projetoId"
            ? seletorProjetoRef.current?.querySelector<HTMLElement>("button")
            : formulario.querySelector<HTMLElement>(
                compacto && primeiroErro === "prazo"
                  ? "[data-prazo-atalho]"
                  : `[name="${primeiroErro}"]`,
              );
        alvo?.focus();
      }, 0);
      return;
    }

    const dados: NovaTarefa = {
      projetoId,
      titulo: titulo.trim(),
      descricao,
      status,
      prioridade,
      responsavel: responsavel.trim(),
      prazo,
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

  const nomeProjeto = itensProjeto.find((item) => item.id === projetoId)?.label;
  const seletorProjeto = (
    <Select
      ref={seletorProjetoRef}
      name="projetoId"
      label="Projeto"
      className={compacto ? "e-tarefa-seletor" : undefined}
      data-preenchido={
        compacto && nomeProjeto && !projetoDesconhecido ? "" : undefined
      }
      triggerTooltip={
        compacto
          ? nomeProjeto
            ? `Projeto: ${nomeProjeto}`
            : "Projeto"
          : undefined
      }
      popoverClassName={
        classeOpcoes ? `${classeOpcoes} e-nova-tarefa-opcoes--projeto` : undefined
      }
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
      aria-describedby={
        [avisoProjeto, erros.projetoId && `${id}-projeto-erro`]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      {(item) => (
        <Select.Item id={item.id} textValue={item.label}>
          {item.label}
        </Select.Item>
      )}
    </Select>
  );
  const avisosProjeto = (
    <>
      {erros.projetoId && (
        <p
          id={`${id}-projeto-erro`}
          className="formulario-tarefa__aviso formulario-tarefa__aviso--erro"
          role="alert"
        >
          {erros.projetoId}
        </p>
      )}
      {projetoDesconhecido && (
        <p
          id={`${id}-projeto-aviso`}
          className="formulario-tarefa__aviso"
          role="status"
        >
          {compacto
            ? "Projeto não encontrado. Selecione outro."
            : "O projeto desta tarefa não foi encontrado. Escolha um projeto disponível."}
        </p>
      )}
      {projetos.carregando && (
        <p
          id={`${id}-projeto-aviso`}
          className="formulario-tarefa__aviso"
          role="status"
        >
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
          {projetos.tentando
            ? compacto
              ? "Carregando projetos…"
              : "Tentando de novo…"
            : "Não foi possível carregar os projetos."}
          <Button
            type="button"
            color="link-color"
            size="sm"
            iconLeading={RefreshIcon}
            isLoading={projetos.tentando}
            showTextWhileLoading
            onClick={projetos.tentarDeNovo}
          >
            {compacto ? "Tentar novamente" : "Tentar de novo"}
          </Button>
        </p>
      )}
      {projetos.dados && !projetosDisponiveis && (
        <p
          id={`${id}-projeto-aviso`}
          className="formulario-tarefa__aviso formulario-tarefa__aviso--acao"
          role="status"
        >
          <span>
            {compacto
              ? "Nenhum projeto cadastrado."
              : "Nenhum projeto cadastrado. Crie um projeto antes de salvar a tarefa."}{" "}
          </span>
          <Link
            to="/projetos/novo"
            onClick={(evento) => {
              if (
                !ficha ||
                evento.ctrlKey ||
                evento.metaKey ||
                evento.shiftKey ||
                evento.altKey
              )
                return;
              evento.preventDefault();
              ficha.navegar("/projetos/novo");
            }}
          >
            Criar projeto
          </Link>
        </p>
      )}
    </>
  );
  const campoResponsavel = (
    <Input
      name="responsavel"
      label="Responsável"
      placeholder={compacto ? "Responsável" : "Nome"}
      size="sm"
      icon={compacto ? IconeResponsavel : undefined}
      isRequired
      validationBehavior="aria"
      value={responsavel}
      onChange={(valor) => {
        setResponsavel(valor);
        limparErro("responsavel");
      }}
      isInvalid={Boolean(erros.responsavel)}
      hint={
        erros.responsavel ? (
          <span role="alert">{erros.responsavel}</span>
        ) : undefined
      }
    />
  );
  const campoPrazo = edicao && !compacto ? (
    <Input
      name="prazo"
      label="Prazo"
      type="date"
      size="sm"
      isRequired
      validationBehavior="aria"
      value={prazo}
      onChange={mudarPrazo}
      isInvalid={Boolean(erros.prazo)}
      hint={
        erros.prazo ? (
          <span role="alert">{erros.prazo}</span>
        ) : undefined
      }
    />
  ) : (
    <PrazoNovaTarefa
      valor={prazo}
      erro={erros.prazo}
      onChange={mudarPrazo}
      formulario={compacto ? id : undefined}
      idErro={compacto ? `${id}-prazo-erro` : undefined}
    />
  );
  const seletorStatus = (
    <Select
      name="status"
      label="Status"
      className={compacto ? "e-tarefa-seletor" : undefined}
      icon={compacto ? <Icon name={iconesStatus[status]} /> : undefined}
      triggerTooltip={compacto ? `Status: ${statusTexto[status]}` : undefined}
      popoverClassName={
        classeOpcoes ? `${classeOpcoes} e-nova-tarefa-opcoes--status` : undefined
      }
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
  );
  const seletorPrioridade = (
    <Select
      name="prioridade"
      label="Prioridade"
      className={compacto ? "e-tarefa-seletor" : undefined}
      icon={compacto ? <Icon name={iconesPrioridade[prioridade]} /> : undefined}
      triggerTooltip={compacto ? `Prioridade: ${prioridadeTexto[prioridade]}` : undefined}
      popoverClassName={classeOpcoes}
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
  );
  const BotaoDescricao = compacto ? BotaoAria : "button";
  const rotuloDescricao = descricaoAberta
    ? "Ocultar descrição"
    : descricao.trim()
      ? "Mostrar descrição"
      : "Adicionar descrição";
  const botaoDescricao = (
    <BotaoDescricao
      type="button"
      className={
        compacto ? "e-description-toggle e-tarefa-atalho" : "e-description-toggle"
      }
      data-preenchido={compacto && descricao.trim() ? "" : undefined}
      aria-label={compacto ? rotuloDescricao : undefined}
      aria-expanded={descricaoAberta}
      aria-controls={descricaoAberta ? `${id}-descricao` : undefined}
      onClick={() => {
        setFocarDescricao(true);
        setDescricaoAberta((aberta) => !aberta);
      }}
    >
      <Icon
        name={compacto ? "document" : descricaoAberta ? "minus-small" : "plus-small"}
      />
      {!compacto && (
        <>
          {descricaoAberta ? "Descrição" : "Adicionar descrição"}
          <span>opcional</span>
        </>
      )}
    </BotaoDescricao>
  );
  const campoDescricao = descricaoAberta && (
    <div id={`${id}-descricao`} className="e-description-body">
      <TextArea
        name="descricao"
        label="Descrição"
        placeholder={
          compacto
            ? "Descrição (opcional)"
            : "Contexto, referências ou o que precisa ser entregue…"
        }
        rows={3}
        size="sm"
        autoFocus={compacto && focarDescricao}
        value={descricao}
        onChange={setDescricao}
      />
    </div>
  );
  const acoesEnvio = (
    <>
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
      <Button
        type="submit"
        color="primary"
        size="sm"
        isDisabled={enviando || !podeSalvar}
      >
        {enviando ? "Salvando…" : textoSalvar}
      </Button>
    </>
  );

  // No formulário compacto o aviso fica entre os atalhos e os botões, para
  // que os atalhos não saiam do lugar quando o envio falha.
  const avisoEnvio = erroEnvio && (
    <div className="e-form-error" role="alert">
      <Icon name="exclamation" />
      {erroEnvio === "inexistente"
        ? "Esta tarefa não existe mais. Ela pode ter sido excluída; seus dados foram mantidos."
        : compacto
          ? "Não foi possível salvar. Tente novamente."
          : "Não foi possível salvar a tarefa. Seus dados foram mantidos; tente de novo."}
    </div>
  );

  return (
    <form
      id={compacto ? id : undefined}
      className="e-task-form formulario-tarefa"
      onSubmit={enviar}
      noValidate
      aria-busy={enviando}
    >
      <div className="e-panel-scroll">
        <div className="e-title-field">
          <Input
            name="titulo"
            label="Título"
            placeholder={compacto ? "Título" : "O que precisa ser feito?"}
            autoFocus
            isRequired
            validationBehavior="aria"
            size="md"
            value={titulo}
            onChange={(valor) => {
              setTitulo(valor);
              limparErro("titulo");
            }}
            isInvalid={Boolean(erros.titulo)}
            hint={
              erros.titulo ? (
                <span role="alert">{erros.titulo}</span>
              ) : undefined
            }
          />
        </div>

        {compacto ? (
          <div className="e-tarefa-compacta">
            <div className="e-tarefa-responsavel">{campoResponsavel}</div>
            <div className="e-tarefa-avisos">
              {avisosProjeto}
              {erros.prazo && (
                <p
                  id={`${id}-prazo-erro`}
                  className="formulario-tarefa__aviso formulario-tarefa__aviso--erro"
                  role="alert"
                >
                  {erros.prazo}
                </p>
              )}
            </div>
            {campoDescricao}
          </div>
        ) : (
          <>
            <div className="e-properties">
              <div className="formulario-tarefa__projeto">
                {seletorProjeto}
                {avisosProjeto}
              </div>
              <div className="e-form-two e-person-date">
                {campoResponsavel}
                {campoPrazo}
              </div>
              <div className="e-form-two">
                {seletorStatus}
                {seletorPrioridade}
              </div>
            </div>
            <div className="e-description">
              {botaoDescricao}
              {campoDescricao}
            </div>
          </>
        )}
      </div>

      {!compacto && avisoEnvio}

      <div className={compacto ? "e-form-footer e-tarefa-rodape" : "e-form-footer"}>
        {compacto ? (
          <>
            <div
              className="e-tarefa-atalhos"
              role="group"
              aria-label="Detalhes da tarefa"
            >
              {seletorProjeto}
              {campoPrazo}
              {seletorStatus}
              {seletorPrioridade}
              <Tooltip title={rotuloDescricao}>{botaoDescricao}</Tooltip>
            </div>
            {avisoEnvio}
            <div className="e-tarefa-envio">{acoesEnvio}</div>
          </>
        ) : (
          acoesEnvio
        )}
      </div>
    </form>
  );
}
