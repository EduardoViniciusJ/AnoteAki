import { IconButton } from "./IconButton";
import "./Toast.css";

export interface ToastProps {
  message: string;
  onDismiss: () => void;
  variant?: "default" | "error";
  action?: { label: string; onClick: () => void };
}

/** Aviso não bloqueante no rodapé da janela. */
export function Toast({ message, onDismiss, variant = "default", action }: ToastProps) {
  return (
    <div className={variant === "error" ? "toast toast--error" : "toast"} role="status">
      <span className="toast__message">{message}</span>
      {action && (
        <button type="button" className="toast__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      <IconButton icon="close" label="Fechar aviso" onClick={onDismiss} />
    </div>
  );
}
