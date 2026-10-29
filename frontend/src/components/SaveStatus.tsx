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

/** Small indicator at the bottom of the note. */
export function SaveStatus({ status }: SaveStatusProps) {
  return (
    // aria-live without role="status": screen readers announce it without competing with the Toast.
    <p className={`save-status save-status--${status}`} aria-live="polite">
      {status === "idle" ? "" : LABELS[status]}
    </p>
  );
}
