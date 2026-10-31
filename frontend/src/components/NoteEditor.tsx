import type { KeyboardEvent, Ref } from "react";
import { formatStamp } from "../lib/dates";
import { duplicateLine, insertText, type LineEdit, moveLine } from "../lib/lines";
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
  // Replacing the whole value resets the native undo stack (trade-off of a
  // controlled textarea); Ctrl+; avoids that via execCommand when available.
  const apply = (editor: HTMLTextAreaElement, edit: LineEdit) => {
    onChange(edit.text);
    // After React re-renders with the new value.
    requestAnimationFrame(() => {
      editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || event.defaultPrevented) return;
    const editor = event.currentTarget;
    const { selectionStart, selectionEnd } = editor;
    // Ctrl+Alt is AltGr on ABNT2 keyboards: it types characters, so it is not a shortcut.
    const ctrl = event.ctrlKey && !event.altKey;
    const alt = event.altKey && !event.ctrlKey;
    if (ctrl && event.key.toLowerCase() === "d") {
      event.preventDefault();
      apply(editor, duplicateLine(value, selectionStart));
    } else if (ctrl && event.key === ";") {
      event.preventDefault();
      const stamp = formatStamp(new Date());
      // insertText keeps the native undo stack; jsdom (tests) has no execCommand.
      if (!document.execCommand?.("insertText", false, stamp)) {
        apply(editor, insertText(value, selectionStart, selectionEnd, stamp));
      }
    } else if (alt && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const edit = moveLine(value, selectionStart, event.key === "ArrowUp" ? "up" : "down");
      if (edit) apply(editor, edit);
    }
  };

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
      onKeyDown={onKeyDown}
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
