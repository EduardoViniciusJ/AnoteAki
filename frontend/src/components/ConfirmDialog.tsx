import { useEffect, useId, useRef } from "react";
import "./ConfirmDialog.css";

export interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for a destructive action, at the bottom. Focus starts on "Cancel"; Esc cancels. */
export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="confirm-dialog"
      role="alertdialog"
      aria-modal="false"
      aria-describedby={messageId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // Esc closes only the dialog, without leaving the screen.
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <span id={messageId} className="confirm-dialog__message">
        {message}
      </span>
      <button ref={cancelRef} type="button" className="confirm-dialog__button" onClick={onCancel}>
        Cancelar
      </button>
      <button
        type="button"
        className="confirm-dialog__button confirm-dialog__button--danger"
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
