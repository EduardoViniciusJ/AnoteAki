import type { Ref } from "react";
import "./NoteEditor.css";

export interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function NoteEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  ref,
}: NoteEditorProps) {
  return (
    <textarea
      ref={ref}
      className="note-editor"
      aria-label="Texto da nota"
      spellCheck
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Focuses the editor and puts the cursor at the end of the text. */
export function focusAtEnd(editor: HTMLTextAreaElement | null) {
  if (!editor) return;
  editor.focus();
  const end = editor.value.length;
  editor.setSelectionRange(end, end);
}
