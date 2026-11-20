import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
  Radio,
  RadioGroup,
} from "react-aria-components";
import { Icon } from "../design/icon";
import { escolherTema, useTema } from "../hooks/useTema";
import { movimentoReduzido } from "../hooks/useMovimento";
import {
  TEMAS_DE_CORES,
  type Esquema,
} from "../temas/catalogo";
import "./MenuAparencia.css";

const celular = matchMedia("(max-width: 650px)");
function observarCelular(ouvinte: () => void) {
  celular.addEventListener("change", ouvinte);
  return () => celular.removeEventListener("change", ouvinte);
}
function useCelular() {
  return useSyncExternalStore(observarCelular, () => celular.matches);
}

const GRUPOS: { esquema: Esquema; titulo: string }[] = [
  { esquema: "escuro", titulo: "Escuros" },
  { esquema: "claro", titulo: "Claros" },
];

export function MenuAparencia() {
  const noCelular = useCelular();
  const [aberto, setAberto] = useState(false);
  if (TEMAS_DE_CORES.length < 2) return null;
  return (
    <DialogTrigger isOpen={aberto} onOpenChange={setAberto}>
      <Button className="e-top-configuracoes" aria-label="Configurações">
        <Icon name="configuracoes" />
        <span>Configurações</span>
      </Button>
      {noCelular ? (
        <ModalOverlay isDismissable className="e-tema-veu">
          <Modal className="e-tema-painel">
            <ConteudoTemas noCelular fechar={() => setAberto(false)} />
          </Modal>
        </ModalOverlay>
      ) : (
        <Popover
          placement="bottom end"
          offset={8}
          containerPadding={12}
          className="e-tema-popover"
        >
          <ConteudoTemas fechar={() => setAberto(false)} />
        </Popover>
      )}
    </DialogTrigger>
  );
}

function ConteudoTemas({
  noCelular = false,
  fechar,
}: {
  noCelular?: boolean;
  fechar: () => void;
}) {
  const tema = useTema();
  const titulo = useId();
  const arrasto = useArrasto(fechar);
  const corpo = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lista = corpo.current;
    const selecionado = lista?.querySelector("[data-selected]");
    if (!lista || !selecionado) return;
    const opcao = selecionado.getBoundingClientRect();
    const area = lista.getBoundingClientRect();
    lista.scrollTop += opcao.top - area.top + (opcao.height - area.height) / 2;
  }, []);
  const selecionar = (id: string) => {
    escolherTema(id);
    fechar();
  };
  const confirmar = (evento: KeyboardEvent) => {
    if (
      evento.key === "Enter" &&
      evento.target instanceof HTMLInputElement &&
      evento.target.type === "radio"
    ) {
      evento.preventDefault();
      selecionar(evento.target.value);
    }
  };
  return (
    <Dialog className="e-tema-dialogo" aria-labelledby={titulo}>
      <div className="e-tema-topo" {...(noCelular ? arrasto : {})}>
        {noCelular && <span className="e-tema-alca" aria-hidden="true" />}
        <div className="e-tema-cabecalho">
          <Icon name={tema.esquema === "claro" ? "sol" : "lua"} />
          <Heading slot="title" id={titulo} className="e-tema-titulo">
            Aparência
          </Heading>
        </div>
        <Button
          className="e-tema-fechar"
          aria-label="Fechar"
          onPress={fechar}
        >
          <Icon name="cross-small" />
        </Button>
      </div>
      <div ref={corpo} className="e-tema-corpo" onKeyDownCapture={confirmar}>
        <RadioGroup
          value={tema.id}
          onChange={escolherTema}
          aria-labelledby={titulo}
          className="e-tema-grupo"
        >
          {GRUPOS.map((grupo) => (
            <SecaoTemas
              key={grupo.esquema}
              {...grupo}
              atual={tema.id}
              selecionar={selecionar}
            />
          ))}
        </RadioGroup>
      </div>
    </Dialog>
  );
}

function SecaoTemas({
  esquema,
  titulo,
  atual,
  selecionar,
}: {
  esquema: Esquema;
  titulo: string;
  atual: string;
  selecionar: (id: string) => void;
}) {
  const id = useId();
  const temas = TEMAS_DE_CORES.filter((item) => item.esquema === esquema);
  if (temas.length === 0) return null;
  return (
    <div role="group" aria-labelledby={id} className="e-tema-secao">
      <h3 id={id} className="e-tema-secao-titulo">
        {titulo}
      </h3>
      {temas.map((item) => (
        <Radio
          key={item.id}
          value={item.id}
          autoFocus={item.id === atual}
          onPress={() => selecionar(item.id)}
          aria-label={`${item.nome}, tema ${esquema}`}
          className="e-tema-opcao"
        >
          <span className="e-tema-opcao-nome">{item.nome}</span>
          <span
            className="e-tema-indicio"
            data-tema={item.id}
            data-esquema={esquema}
            aria-hidden="true"
          />
          <span className="e-tema-opcao-marca" aria-hidden="true">
            <Icon name="check" />
          </span>
        </Radio>
      ))}
    </div>
  );
}

function useArrasto(fechar: () => void) {
  const inicio = useRef<number | null>(null);
  const deslocamento = useRef(0);
  const ultimo = useRef({ y: 0, t: 0, velocidade: 0 });
  const painel = (alvo: Element) => alvo.closest<HTMLElement>(".e-tema-painel");
  const mover = (alvo: HTMLElement, y: number, suave: boolean) => {
    alvo.toggleAttribute("data-soltando", suave && !movimentoReduzido());
    alvo.style.setProperty("--e-tema-arrasto", `${y}px`);
    alvo.style.transform = y ? `translateY(${y}px)` : "";
  };
  return {
    onPointerDown(evento: PointerEvent<HTMLElement>) {
      if (evento.button !== 0) return;
      if ((evento.target as Element).closest("button")) return;
      inicio.current = evento.clientY;
      deslocamento.current = 0;
      ultimo.current = {
        y: evento.clientY,
        t: evento.timeStamp,
        velocidade: 0,
      };
      evento.currentTarget.setPointerCapture(evento.pointerId);
    },
    onPointerMove(evento: PointerEvent<HTMLElement>) {
      if (inicio.current === null) return;
      const alvo = painel(evento.currentTarget);
      if (!alvo) return;
      deslocamento.current = Math.max(0, evento.clientY - inicio.current);
      const intervalo = evento.timeStamp - ultimo.current.t;
      if (intervalo > 0)
        ultimo.current = {
          y: evento.clientY,
          t: evento.timeStamp,
          velocidade: (evento.clientY - ultimo.current.y) / intervalo,
        };
      mover(alvo, deslocamento.current, false);
    },
    onPointerUp(evento: PointerEvent<HTMLElement>) {
      if (inicio.current === null) return;
      inicio.current = null;
      const alvo = painel(evento.currentTarget);
      if (!alvo) return;
      const altura = alvo.getBoundingClientRect().height;
      const soltouEmMovimento =
        evento.timeStamp - ultimo.current.t < 100 &&
        ultimo.current.velocidade > 0.6;
      if (
        deslocamento.current > Math.min(120, altura / 3) ||
        (deslocamento.current > 24 && soltouEmMovimento)
      )
        fechar();
      else mover(alvo, 0, true);
    },
    onPointerCancel(evento: PointerEvent<HTMLElement>) {
      inicio.current = null;
      const alvo = painel(evento.currentTarget);
      if (alvo) mover(alvo, 0, true);
    },
  };
}
