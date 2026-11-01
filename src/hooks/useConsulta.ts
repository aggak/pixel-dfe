import { useCallback, useEffect, useState } from "react";

export function useConsulta<T>(consultar: (signal: AbortSignal) => Promise<T>) {
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{
    consulta: typeof consultar;
    tentativa: number;
    dados?: T;
    erro?: unknown;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    consultar(controller.signal)
      .then((dados) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, tentativa, dados });
      })
      .catch((erro: unknown) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, tentativa, erro });
      });
    return () => controller.abort();
  }, [consultar, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((atual) => atual + 1), []);

  // Uma nova consulta não deve exibir os dados da URL anterior.
  const mesmaConsulta = resultado?.consulta === consultar;
  const atual = mesmaConsulta && resultado.tentativa === tentativa ? resultado : undefined;
  const tentando = mesmaConsulta && !atual && resultado?.erro !== undefined;
  return { dados: atual?.dados, erro: tentando ? resultado?.erro : atual?.erro, carregando: !atual && !tentando, tentando, tentarDeNovo };
}
