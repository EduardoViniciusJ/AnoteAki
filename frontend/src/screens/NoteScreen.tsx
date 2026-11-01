import type { Ref } from "react";
import { ColorMenu } from "../components/ColorMenu";
import { IconButton } from "../components/IconButton";
import { NoteEditor } from "../components/NoteEditor";
import { SaveStatus } from "../components/SaveStatus";
import { TitleField } from "../components/TitleField";
import { Toast } from "../components/Toast";
import { WordCount } from "../components/WordCount";
import { useFocusMode } from "../lib/useFocusMode";
import type { Look, SaveStatus as Status } from "../lib/useNoteDraft";
import "./NoteScreen.css";

export interface NoteScreenProps {
  heading: string;
  onHeadingChange: (heading: string) => void;
  body: string;
  onBodyChange: (body: string) => void;
  look: Look;
  onLookChange: (look: Look) => void;
  status: Status;
  /** Note in the trash: read-only editor and a "Restaurar" action. */
  readOnly?: boolean;
  onRestore?: () => void;
  /** `Esc` on the Note screen: hide all sticky notes. */
  onEscape: () => void;
  /** "+" or `Ctrl+N`: a new sticky note. */
  onNewNote: () => void;
  /** "×" or `Ctrl+W`: close this sticky note. */
  onClose: () => void;
  /** "Copiar texto" or `Ctrl+Shift+C`: the whole note to the clipboard. */
  onCopy: () => void;
  /** "Copiar como Markdown" or `Ctrl+Shift+M`: the title becomes a heading. */
  onCopyMarkdown: () => void;
  /** History button, `Ctrl+H` or `Ctrl+F`. */
  onOpenHistory: () => void;
  /** Gear button or `Ctrl+,`. */
  onOpenSettings: () => void;
  /** Hide the toolbar and footer while typing in the editor. */
  focusMode?: boolean;
  /** Enter in the title: go to the text. */
  onTitleSubmit: () => void;
  warning: string | null;
  onDismissWarning: () => void;
  /** Button in the warning, e.g. "Configurações" when the shortcut failed. */
  warningAction?: { label: string; onClick: () => void };
  /** Short confirmation, e.g. "Copiado". */
  notice?: string | null;
  onDismissNotice?: () => void;
  titleRef?: Ref<HTMLInputElement>;
  editorRef?: Ref<HTMLTextAreaElement>;
}

/** Screen 1 (DESIGN-GUIDELINES → Telas e teclado): one sticky note. */
export function NoteScreen({
  heading,
  onHeadingChange,
  body,
  onBodyChange,
  look,
  onLookChange,
  status,
  readOnly = false,
  onRestore,
  onEscape,
  onNewNote,
  onClose,
  onCopy,
  onCopyMarkdown,
  onOpenHistory,
  onOpenSettings,
  focusMode = false,
  onTitleSubmit,
  warning,
  onDismissWarning,
  warningAction,
  notice = null,
  onDismissNotice = () => {},
  titleRef,
  editorRef,
}: NoteScreenProps) {
  const empty = !heading.trim() && !body.trim();
  const focus = useFocusMode(focusMode);
  const fade = focus.hidden ? " is-faded" : "";
  return (
    <section
      className="note-screen screen-enter"
      aria-label="Nota"
      onMouseMove={focus.onMouseMove}
      onBlur={focus.reveal}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        const key = event.key.toLowerCase();
        // Ctrl+Alt is AltGr on ABNT2 keyboards: it types characters, so it is not a shortcut.
        const ctrl = event.ctrlKey && !event.altKey;
        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
        } else if (ctrl && event.shiftKey && key === "c") {
          event.preventDefault();
          if (!empty) onCopy();
        } else if (ctrl && event.shiftKey && key === "m") {
          event.preventDefault();
          if (!empty) onCopyMarkdown();
        } else if (ctrl && key === "n") {
          event.preventDefault();
          onNewNote();
        } else if (ctrl && key === "w") {
          event.preventDefault();
          onClose();
        } else if (ctrl && (key === "h" || key === "f")) {
          event.preventDefault();
          onOpenHistory();
        } else if (ctrl && event.key === ",") {
          event.preventDefault();
          onOpenSettings();
        }
      }}
    >
      <header className={`note-screen__toolbar${fade}`} data-tauri-drag-region="">
        {readOnly && (
          <span className="note-screen__trash">
            Na lixeira
            <button type="button" className="note-screen__restore" onClick={onRestore}>
              Restaurar
            </button>
          </span>
        )}
        <ColorMenu look={look} onChange={onLookChange} disabled={readOnly} />
        <IconButton
          icon="copy"
          label={empty ? "Copiar texto (nota vazia)" : "Copiar texto (Ctrl+Shift+C)"}
          disabled={empty}
          onClick={onCopy}
        />
        <IconButton
          icon="markdown"
          label={
            empty ? "Copiar como Markdown (nota vazia)" : "Copiar como Markdown (Ctrl+Shift+M)"
          }
          disabled={empty}
          onClick={onCopyMarkdown}
        />
        <IconButton icon="plus" label="Nova nota (Ctrl+N)" onClick={onNewNote} />
        <IconButton icon="history" label="Histórico (Ctrl+H)" onClick={onOpenHistory} />
        <IconButton icon="settings" label="Configurações (Ctrl+,)" onClick={onOpenSettings} />
        <IconButton icon="close" label="Fechar post-it (Ctrl+W)" onClick={onClose} />
      </header>
      <TitleField
        ref={titleRef}
        value={heading}
        onChange={onHeadingChange}
        onSubmit={onTitleSubmit}
        readOnly={readOnly}
      />
      <NoteEditor
        ref={editorRef}
        value={body}
        onChange={(text) => {
          onBodyChange(text);
          focus.onType();
        }}
        placeholder="Escreva algo…"
        readOnly={readOnly}
      />
      {warning ? (
        <Toast
          variant="error"
          message={warning}
          onDismiss={onDismissWarning}
          action={warningAction}
        />
      ) : notice ? (
        <Toast message={notice} onDismiss={onDismissNotice} />
      ) : (
        <footer className={`note-screen__footer${fade}`}>
          <WordCount text={body} />
          <SaveStatus status={status} />
        </footer>
      )}
    </section>
  );
}
