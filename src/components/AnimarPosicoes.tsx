import { Component, createRef, type ReactNode } from "react";
import type { Filtros } from "../derivar";
import { movimentoReduzido, observarMovimento } from "../hooks/useMovimento";
import type { Tarefa } from "../tipos";

type Propriedades = {
  children: ReactNode;
  classe: string;
  rotulo: string;
  seletor: string;
  tarefas: Tarefa[];
  filtros: Filtros;
  concluidasAbertas: boolean;
  considerarOrdem?: boolean;
};

type Posicao = { item: HTMLElement; x: number; y: number };
type Posicoes = Map<string, Posicao>;

export class AnimarPosicoes extends Component<
  Propriedades,
  object,
  Posicoes | null
> {
  private raiz = createRef<HTMLElement>();
  private animacoes = new Map<HTMLElement, Animation>();
  private pararDeObservar?: () => void;

  private cancelarAnimacoes = () => {
    for (const animacao of this.animacoes.values()) animacao.cancel();
    this.animacoes.clear();
  };

  private medirPosicoes(seletor: string): Posicoes {
    const posicoes: Posicoes = new Map();
    const raiz = this.raiz.current;
    if (!raiz) return posicoes;

    const origem = raiz.getBoundingClientRect();
    for (const item of raiz.querySelectorAll<HTMLElement>(seletor)) {
      const caixa = item.getBoundingClientRect();
      posicoes.set(item.dataset.taskId!, {
        item,
        x: caixa.left - origem.left,
        y: caixa.top - origem.top,
      });
    }
    return posicoes;
  }

  componentDidMount() {
    this.pararDeObservar = observarMovimento(() => {
      if (movimentoReduzido()) this.cancelarAnimacoes();
    });
  }

  componentWillUnmount() {
    this.pararDeObservar?.();
    this.cancelarAnimacoes();
  }

  getSnapshotBeforeUpdate(anteriores: Propriedades): Posicoes | null {
    const { filtros, concluidasAbertas, tarefas, considerarOrdem } = this.props;
    if (
      movimentoReduzido() ||
      filtros !== anteriores.filtros ||
      concluidasAbertas !== anteriores.concluidasAbertas ||
      tarefas === anteriores.tarefas
    )
      return null;

    const porId = new Map(
      anteriores.tarefas.map((tarefa) => [tarefa.id, tarefa]),
    );
    const moveu = tarefas.some((tarefa) => {
      const anterior = porId.get(tarefa.id);
      return (
        anterior &&
        (anterior.status !== tarefa.status ||
          (considerarOrdem && anterior.ordem !== tarefa.ordem))
      );
    });
    return moveu ? this.medirPosicoes(anteriores.seletor) : null;
  }

  componentDidUpdate(
    anteriores: Propriedades,
    _estado: object,
    posicoes: Posicoes | null,
  ) {
    if (
      posicoes ||
      movimentoReduzido() ||
      this.props.filtros !== anteriores.filtros ||
      this.props.concluidasAbertas !== anteriores.concluidasAbertas
    )
      this.cancelarAnimacoes();
    if (!posicoes) return;

    const atuais = this.medirPosicoes(this.props.seletor);
    for (const [id, atual] of atuais) {
      const anterior = posicoes.get(id);
      if (!anterior) continue;
      const x = anterior.x - atual.x;
      const y = anterior.y - atual.y;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) continue;

      const { item } = atual;
      const animacao = item.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }],
        { duration: 210, easing: "cubic-bezier(0.2, 0.75, 0.25, 1)" },
      );
      this.animacoes.set(item, animacao);
      animacao.onfinish = () => {
        if (this.animacoes.get(item) === animacao) this.animacoes.delete(item);
      };
    }
  }

  render() {
    const { children, classe, rotulo } = this.props;
    return (
      <section
        ref={this.raiz}
        className={classe}
        aria-label={rotulo}
        onDragStartCapture={this.cancelarAnimacoes}
      >
        {children}
      </section>
    );
  }
}
