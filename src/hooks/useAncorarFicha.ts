import { useLayoutEffect, type RefObject } from "react";

export type LugarFicha = "quadro";

const DESKTOP =
  "(min-width: 1024px) and (min-height: 501px) and (pointer: fine)";
const MARGEM = 12;
const VAO = 8;

const limitar = (valor: number, maximo: number) =>
  Math.max(MARGEM, Math.min(valor, maximo - MARGEM));

function escreverPx(alvo: HTMLElement, nome: string, valor: number) {
  const px = `${valor}px`;
  if (alvo.style.getPropertyValue(nome) !== px)
    alvo.style.setProperty(nome, px);
}

function fimDoCabecalho() {
  return document.querySelector(".e-top")?.getBoundingClientRect().bottom ?? 0;
}

function soltar(modal: HTMLElement) {
  modal.removeAttribute("data-ancorada");
  modal.removeAttribute("data-ancorada-sem-espaco");
  for (const nome of ["--ficha-x", "--ficha-y", "--ficha-topo"])
    modal.style.removeProperty(nome);
}

function ancorarQuadro(modal: HTMLElement, seletor: string) {
  const pagina = document.documentElement;
  let x = 0;
  let y = 0;

  const encaixar = () => {
    if (!modal.hasAttribute("data-ancorada")) return;
    escreverPx(
      modal,
      "--ficha-x",
      limitar(x, pagina.clientWidth - modal.offsetWidth),
    );
    escreverPx(
      modal,
      "--ficha-y",
      limitar(y, window.innerHeight - modal.offsetHeight),
    );
  };

  const posicionar = () => {
    const cartao = document.querySelector<HTMLElement>(
      `.e-board .e-card${seletor}`,
    );
    if (!cartao) {
      soltar(modal);
      return false;
    }
    let caixa = cartao.getBoundingClientRect();
    const topo = fimDoCabecalho();
    if (caixa.bottom <= topo || caixa.top >= window.innerHeight) {
      window.scrollBy({
        top: caixa.top - Math.round(window.innerHeight * 0.3),
        behavior: "instant",
      });
      caixa = cartao.getBoundingClientRect();
    }
    const largura = modal.offsetWidth;
    const cabeDireita =
      caixa.right + VAO + largura <= pagina.clientWidth - MARGEM;
    const cabeEsquerda = caixa.left - VAO - largura >= MARGEM;
    const semEspaco = !cabeDireita && !cabeEsquerda;
    if (semEspaco) {
      const coluna = (cartao.parentElement ?? cartao).getBoundingClientRect();
      x = coluna.right - largura;
      y = Math.max(topo + MARGEM, coluna.top);
    } else {
      x = cabeDireita ? caixa.right + VAO : caixa.left - VAO - largura;
      y = caixa.top;
    }
    modal.setAttribute("data-ancorada", "");
    modal.toggleAttribute("data-ancorada-sem-espaco", semEspaco);
    encaixar();
    return true;
  };

  const espera = new MutationObserver(() => {
    if (posicionar()) espera.disconnect();
  });
  const raiz = document.getElementById("root");
  if (!posicionar() && raiz)
    espera.observe(raiz, { childList: true, subtree: true });

  const tamanho = new ResizeObserver(encaixar);
  tamanho.observe(modal);
  window.addEventListener("resize", posicionar);
  return () => {
    espera.disconnect();
    tamanho.disconnect();
    window.removeEventListener("resize", posicionar);
    soltar(modal);
  };
}

export function useAncorarFicha(
  casca: RefObject<HTMLElement | null>,
  tarefa: string | undefined,
  lugar: LugarFicha | undefined,
) {
  useLayoutEffect(() => {
    const modal = casca.current?.closest<HTMLElement>(".e-form-modal");
    if (!modal || !tarefa || !lugar) return;
    const seletor = `[data-task-id="${CSS.escape(tarefa)}"]`;
    const desktop = window.matchMedia(DESKTOP);
    let parar: (() => void) | undefined;
    const atualizar = () => {
      parar?.();
      parar = undefined;
      delete modal.dataset.lugar;
      if (!desktop.matches) return;
      modal.dataset.lugar = lugar;
      parar = ancorarQuadro(modal, seletor);
    };
    desktop.addEventListener("change", atualizar);
    atualizar();
    return () => {
      desktop.removeEventListener("change", atualizar);
      parar?.();
      delete modal.dataset.lugar;
    };
  }, [casca, tarefa, lugar]);
}
