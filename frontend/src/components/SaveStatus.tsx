import type { SaveStatus as Status } from "../lib/useNoteDraft";
import "./SaveStatus.css";

const LABELS: Record<Exclude<Status, "idle">, string> = {
  saving: "Salvando…",
  saved: "Salvo",
  error: "Erro ao salvar",
};

export interface SaveStatusProps {
  status: Status;
}

/** Indicador discreto no rodapé da nota. */
export function SaveStatus({ status }: SaveStatusProps) {
  return (
    // aria-live sem role="status": o leitor de tela anuncia, mas sem competir com o Toast.
    <p className={`save-status save-status--${status}`} aria-live="polite">
      {status === "idle" ? "" : LABELS[status]}
    </p>
  );
}
