import type { Ref } from "react";
import { IconButton } from "../components/IconButton";
import { NoteEditor } from "../components/NoteEditor";
import { SaveStatus } from "../components/SaveStatus";
import { Toast } from "../components/Toast";
import type { SaveStatus as Status } from "../lib/useNoteDraft";
import "./NoteScreen.css";

export interface NoteScreenProps {
  body: string;
  onBodyChange: (body: string) => void;
  status: Status;
  /** Note in the trash: read-only editor and a "Restaurar" action. */
  readOnly?: boolean;
  onRestore?: () => void;
  /** `Esc` on the Note screen: hide the window. */
  onEscape: () => void;
  /** "+" or `Ctrl+N`. */
  onNewNote: () => void;
  /** History button, `Ctrl+H` or `Ctrl+F`. */
  onOpenHistory: () => void;
  warning: string | null;
  onDismissWarning: () => void;
  editorRef?: Ref<HTMLTextAreaElement>;
}

/** Screen 1 (DESIGN-GUIDELINES → Telas e teclado). */
export function NoteScreen({
  body,
  onBodyChange,
  status,
  readOnly = false,
  onRestore,
  onEscape,
  onNewNote,
  onOpenHistory,
  warning,
  onDismissWarning,
  editorRef,
}: NoteScreenProps) {
  return (
    <section
      className="note-screen"
      aria-label="Nota"
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        const key = event.key.toLowerCase();
        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
        } else if (event.ctrlKey && !event.altKey && key === "n") {
          event.preventDefault();
          onNewNote();
        } else if (event.ctrlKey && !event.altKey && (key === "h" || key === "f")) {
          event.preventDefault();
          onOpenHistory();
        }
      }}
    >
      <header className="note-screen__toolbar" data-tauri-drag-region="">
        {readOnly && (
          <span className="note-screen__trash">
            Na lixeira
            <button type="button" className="note-screen__restore" onClick={onRestore}>
              Restaurar
            </button>
          </span>
        )}
        <IconButton icon="plus" label="Nova nota (Ctrl+N)" onClick={onNewNote} />
        <IconButton icon="history" label="Histórico (Ctrl+H)" onClick={onOpenHistory} />
        {/* Disabled until the Settings screen (T52). */}
        <IconButton icon="settings" label="Configurações (Ctrl+,) — em breve" disabled />
      </header>
      <NoteEditor
        ref={editorRef}
        value={body}
        onChange={onBodyChange}
        placeholder="Escreva algo…"
        readOnly={readOnly}
      />
      {warning ? (
        <Toast variant="error" message={warning} onDismiss={onDismissWarning} />
      ) : (
        <SaveStatus status={status} />
      )}
    </section>
  );
}
