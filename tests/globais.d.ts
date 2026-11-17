export {};

declare global {
  interface Window {
    semRecarga?: boolean;
    marcadorNavegacao?: string;
    prazoEsperado?: string;
    __payloads?: unknown[];
    __cancelamentos?: number;
    __liberarEnvio?: () => void;
    __semRecarga?: boolean;
  }

  interface Element {
    marcaPersistente?: boolean;
  }
}
