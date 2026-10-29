import "./NoteScreen.css";
import { createIconButton } from "../components/IconButton";
import { createNoteEditor } from "../components/NoteEditor";
import { createToast, type ToastProps } from "../components/Toast";

export interface NoteScreenProps {
  /** `Esc` na tela Nota: esconder a janela. */
  onEscape: () => void;
}

/** Tela 1 (DESIGN-GUIDELINES → Telas e teclado). Salvar entra no T22. */
export function createNoteScreen(props: NoteScreenProps) {
  let current = props;
  const el = document.createElement("section");
  el.className = "note-screen";
  el.setAttribute("aria-label", "Nota");

  const toolbar = document.createElement("header");
  toolbar.className = "note-screen__toolbar";
  toolbar.setAttribute("data-tauri-drag-region", "");

  // Desabilitados até as tarefas que dão função a eles (T22, T31, T52).
  const buttons = [
    createIconButton({ icon: "plus", label: "Nova nota (Ctrl+N) — em breve", disabled: true }),
    createIconButton({ icon: "history", label: "Histórico (Ctrl+H) — em breve", disabled: true }),
    createIconButton({
      icon: "settings",
      label: "Configurações (Ctrl+,) — em breve",
      disabled: true,
    }),
  ];
  toolbar.append(...buttons.map((button) => button.el));

  const editor = createNoteEditor({ value: "", placeholder: "Escreva algo…" });

  let toast: ReturnType<typeof createToast> | null = null;

  el.append(toolbar, editor.el);

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      current.onEscape();
    }
  };
  el.addEventListener("keydown", handleKeydown);

  function hideToast() {
    toast?.destroy();
    toast = null;
  }

  return {
    el,
    update(next: NoteScreenProps) {
      current = next;
    },
    focusEditor() {
      editor.focus();
    },
    showToast(toastProps: Omit<ToastProps, "onDismiss">) {
      const withDismiss: ToastProps = {
        ...toastProps,
        onDismiss: () => {
          hideToast();
          editor.focus();
        },
      };
      if (toast) {
        toast.update(withDismiss);
      } else {
        toast = createToast(withDismiss);
        el.append(toast.el);
      }
    },
    destroy() {
      el.removeEventListener("keydown", handleKeydown);
      hideToast();
      for (const button of buttons) button.destroy();
      editor.destroy();
      el.remove();
    },
  };
}
