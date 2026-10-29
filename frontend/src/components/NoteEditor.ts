import "./NoteEditor.css";

export interface NoteEditorProps {
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onInput?: (value: string) => void;
}

export function createNoteEditor(props: NoteEditorProps) {
  let current = props;
  const el = document.createElement("textarea");
  el.className = "note-editor";
  el.spellcheck = true;
  el.setAttribute("aria-label", "Texto da nota");

  const handleInput = () => current.onInput?.(el.value);
  el.addEventListener("input", handleInput);

  function update(next: NoteEditorProps) {
    current = next;
    // Só reescreve se mudou, para não mover o cursor enquanto o usuário digita.
    if (el.value !== next.value) el.value = next.value;
    el.placeholder = next.placeholder ?? "";
    el.readOnly = Boolean(next.readOnly);
  }

  update(props);

  return {
    el,
    update,
    /** Foca e põe o cursor no fim do texto. */
    focus() {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    },
    destroy() {
      el.removeEventListener("input", handleInput);
      el.remove();
    },
  };
}
