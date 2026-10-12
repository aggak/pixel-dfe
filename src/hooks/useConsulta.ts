import { useEffect, useState } from "react";

export function useConsulta<T>(consultar: (signal: AbortSignal) => Promise<T>) {
  const [resultado, setResultado] = useState<{
    consulta: typeof consultar;
    dados?: T;
    erro?: unknown;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    consultar(controller.signal)
      .then((dados) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, dados });
      })
      .catch((erro: unknown) => {
        if (!controller.signal.aborted) setResultado({ consulta: consultar, erro });
      });
    return () => controller.abort();
  }, [consultar]);

  // Uma nova consulta não deve exibir os dados da URL anterior.
  const atual = resultado?.consulta === consultar ? resultado : undefined;
  return { dados: atual?.dados, erro: atual?.erro, carregando: !atual };
}
