import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const ContextoAtualizacao = createContext<string | undefined>(undefined);

export const ContextoTentativaFundo = createContext(0);
export const ContextoAoTentarDeNovo = createContext<(() => void) | undefined>(
  undefined,
);

export function useConsulta<T>(
  consultar: (signal: AbortSignal) => Promise<T>,
  ultimosDados?: T,
) {
  const atualizacao = useContext(ContextoAtualizacao);
  const tentativaFundo = useContext(ContextoTentativaFundo);
  const aoTentarDeNovo = useContext(ContextoAoTentarDeNovo);
  const [ultimaTentativaFundo, setUltimaTentativaFundo] =
    useState(tentativaFundo);
  const [tentativa, setTentativa] = useState(0);
  const [geracao, setGeracao] = useState(0);
  const leitura = useRef<AbortController | null>(null);
  const [resultado, setResultado] = useState<{
    consulta: typeof consultar;
    tentativa: number;
    atualizacao: typeof atualizacao;
    dados?: T;
    erro?: unknown;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    leitura.current = controller;
    const encerrar = () => {
      if (leitura.current === controller) leitura.current = null;
      return !controller.signal.aborted;
    };
    consultar(controller.signal)
      .then((dados) => {
        if (encerrar())
          setResultado({ consulta: consultar, tentativa, atualizacao, dados });
      })
      .catch((erro: unknown) => {
        if (encerrar())
          setResultado({ consulta: consultar, tentativa, atualizacao, erro });
      });
    return () => controller.abort();
  }, [consultar, tentativa, atualizacao, geracao]);

  const refazer = useCallback(() => {
    if (!leitura.current) return;
    leitura.current.abort();
    leitura.current = null;
    setGeracao((atual) => atual + 1);
  }, []);

  const tentarDeNovo = useCallback(() => {
    setTentativa((atual) => atual + 1);
    aoTentarDeNovo?.();
  }, [aoTentarDeNovo]);

  const mesmaConsulta = resultado?.consulta === consultar;
  const atual =
    mesmaConsulta &&
    resultado.tentativa === tentativa &&
    resultado.atualizacao === atualizacao
      ? resultado
      : undefined;
  const tentando = mesmaConsulta && !atual && resultado?.erro !== undefined;
  const anteriores =
    mesmaConsulta && resultado.tentativa === tentativa
      ? resultado.dados
      : ultimosDados;
  const dados = atual ? atual.dados : tentando ? undefined : anteriores;
  if (ultimaTentativaFundo !== tentativaFundo) {
    setUltimaTentativaFundo(tentativaFundo);
    if (atual?.erro !== undefined) setTentativa((anterior) => anterior + 1);
  }
  return {
    dados,
    erro: tentando ? resultado?.erro : atual?.erro,
    carregando: !atual && !tentando && dados === undefined,
    revalidando: !atual,
    tentando,
    tentarDeNovo,
    refazer,
  };
}
