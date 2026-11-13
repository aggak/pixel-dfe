import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const ContextoAtualizacao = createContext<string | undefined>(undefined);

export function useConsulta<T>(consultar: (signal: AbortSignal) => Promise<T>, ultimosDados?: T) {
  const atualizacao = useContext(ContextoAtualizacao);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{
    consulta: typeof consultar;
    tentativa: number;
    atualizacao: typeof atualizacao;
    dados?: T;
    erro?: unknown;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    consultar(controller.signal)
      .then((dados) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, tentativa, atualizacao, dados });
      })
      .catch((erro: unknown) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, tentativa, atualizacao, erro });
      });
    return () => controller.abort();
  }, [consultar, tentativa, atualizacao]);

  const tentarDeNovo = useCallback(() => setTentativa((atual) => atual + 1), []);

  // Uma nova consulta não deve exibir os dados da URL anterior.
  const mesmaConsulta = resultado?.consulta === consultar;
  const atual = mesmaConsulta && resultado.tentativa === tentativa && resultado.atualizacao === atualizacao ? resultado : undefined;
  const tentando = mesmaConsulta && !atual && resultado?.erro !== undefined;
  const anteriores = mesmaConsulta && resultado.tentativa === tentativa ? resultado.dados : ultimosDados;
  const dados = atual ? atual.dados : tentando ? undefined : anteriores;
  return { dados, erro: tentando ? resultado?.erro : atual?.erro, carregando: !atual && !tentando && dados === undefined, revalidando: !atual, tentando, tentarDeNovo };
}
