import type { Ref } from "react";
import { IconButton } from "../components/IconButton";
import { NoteEditor } from "../components/NoteEditor";
import { Toast } from "../components/Toast";
import "./NoteScreen.css";

export interface NoteScreenProps {
  body: string;
  onBodyChange: (body: string) => void;
  /** `Esc` na tela Nota: esconder a janela. */
  onEscape: () => void;
  warning: string | null;
  onDismissWarning: () => void;
  editorRef?: Ref<HTMLTextAreaElement>;
}

/** Tela 1 (DESIGN-GUIDELINES → Telas e teclado). Salvar entra no T22. */
export function NoteScreen({
  body,
  onBodyChange,
  onEscape,
  warning,
  onDismissWarning,
  editorRef,
}: NoteScreenProps) {
  return (
    <section
      className="note-screen"
      aria-label="Nota"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onEscape();
        }
      }}
    >
      <header className="note-screen__toolbar" data-tauri-drag-region="">
        {/* Desabilitados até as tarefas que dão função a eles (T22, T31, T52). */}
        <IconButton icon="plus" label="Nova nota (Ctrl+N) — em breve" disabled />
        <IconButton icon="history" label="Histórico (Ctrl+H) — em breve" disabled />
        <IconButton icon="settings" label="Configurações (Ctrl+,) — em breve" disabled />
      </header>
      <NoteEditor
        ref={editorRef}
        value={body}
        onChange={onBodyChange}
        placeholder="Escreva algo…"
      />
      {warning && <Toast variant="error" message={warning} onDismiss={onDismissWarning} />}
    </section>
  );
}
