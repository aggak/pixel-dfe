import { useCallback, useEffect, useRef, useState } from "react";

const PRAZO_ARMADO = 5000;
const CARENCIA = 400;

export function useExcluirEmDoisToques(onExcluir: () => Promise<void>) {
  const [armado, setArmado] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [falha, setFalha] = useState(false);
  const relogios = useRef<number[]>([]);
  const pendente = useRef(false);
  const desarmar = useCallback(() => {
    relogios.current.forEach(clearTimeout);
    relogios.current = [];
    setArmado(false);
    setPronto(false);
  }, []);
  useEffect(() => () => relogios.current.forEach(clearTimeout), []);
  const tocar = async () => {
    if (pendente.current) return;
    if (!armado) {
      setFalha(false);
      setArmado(true);
      relogios.current = [
        window.setTimeout(() => setPronto(true), CARENCIA),
        window.setTimeout(desarmar, PRAZO_ARMADO),
      ];
      return;
    }
    if (!pronto) return;
    desarmar();
    pendente.current = true;
    setExcluindo(true);
    try {
      await onExcluir();
    } catch {
      setFalha(true);
    } finally {
      pendente.current = false;
      setExcluindo(false);
    }
  };
  return { armado, pronto, excluindo, falha, tocar, desarmar };
}
