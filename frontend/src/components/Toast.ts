import "./Toast.css";
import { createIconButton } from "./IconButton";

export interface ToastProps {
  message: string;
  variant?: "default" | "error";
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

/** Aviso não bloqueante no rodapé da janela. */
export function createToast(props: ToastProps) {
  let current = props;
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");

  const text = document.createElement("span");
  text.className = "toast__message";

  const action = document.createElement("button");
  action.type = "button";
  action.className = "toast__action";
  action.addEventListener("click", () => current.action?.onClick());

  const dismiss = createIconButton({
    icon: "close",
    label: "Fechar aviso",
    onClick: () => current.onDismiss?.(),
  });

  el.append(text, action, dismiss.el);

  function update(next: ToastProps) {
    current = next;
    text.textContent = next.message;
    el.classList.toggle("toast--error", next.variant === "error");
    action.hidden = !next.action;
    action.textContent = next.action?.label ?? "";
  }

  update(props);

  return {
    el,
    update,
    destroy() {
      dismiss.destroy();
      el.remove();
    },
  };
}
