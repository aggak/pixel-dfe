import { useRef, useState } from "react";
import { Heading } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import {
  Dialog,
  Modal,
  ModalOverlay,
} from "@/components/application/modals/modal";
import type { Tarefa } from "../tipos";

export function ConfirmarExclusao({
  tarefa,
  aberta,
  onFechar,
  onExcluir,
}: {
  tarefa: Tarefa;
  aberta: boolean;
  onFechar: () => void;
  onExcluir: () => Promise<void>;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [falhaExclusao, setFalhaExclusao] = useState(false);
  const [abertaAntes, setAbertaAntes] = useState(aberta);
  if (aberta !== abertaAntes) {
    setAbertaAntes(aberta);
    if (aberta) setFalhaExclusao(false);
  }
  const exclusaoPendente = useRef(false);
  const excluir = async () => {
    if (exclusaoPendente.current) return;
    exclusaoPendente.current = true;
    setExcluindo(true);
    setFalhaExclusao(false);
    try {
      await onExcluir();
    } catch {
      setFalhaExclusao(true);
    } finally {
      exclusaoPendente.current = false;
      setExcluindo(false);
    }
  };
  return (
    <ModalOverlay
      isOpen={aberta}
      onOpenChange={(valor) => {
        if (!valor && !excluindo) onFechar();
      }}
      isDismissable={!excluindo}
      isKeyboardDismissDisabled={excluindo}
      className="e-confirm-overlay"
    >
      <Modal className="e-confirm-modal">
        <Dialog
          className="e-confirm-dialog"
          aria-label={`Excluir ${tarefa.titulo}`}
        >
          <Heading slot="title">Excluir tarefa?</Heading>
          <p>
            Deseja excluir “{tarefa.titulo}”? Esta ação não pode ser desfeita.
          </p>
          {falhaExclusao && (
            <p className="e-confirm-error" role="alert">
              Não foi possível excluir a tarefa. Tente de novo.
            </p>
          )}
          <div className="e-confirm-actions">
            <Button
              color="secondary"
              size="sm"
              onClick={onFechar}
              isDisabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              color="primary-destructive"
              size="sm"
              onClick={() => void excluir()}
              isLoading={excluindo}
              showTextWhileLoading
            >
              {excluindo ? "Excluindo…" : "Excluir tarefa"}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
