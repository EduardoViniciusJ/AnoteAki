import type { KeyboardEvent, MouseEvent, Ref } from "react";
import { duplicateLine, type LineEdit, moveLine } from "../lib/lines";
import { findLinkAt } from "../lib/links";
import "./NoteEditor.css";

export interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** Ctrl+click on an http(s) link in the text. */
  onOpenLink?: (url: string) => void;
  ref?: Ref<HTMLTextAreaElement>;
}

export function NoteEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  onOpenLink,
  ref,
}: NoteEditorProps) {
  // The DOM value and the caret are set right away: waiting for the React
  // re-render leaves the caret at the end for one frame, and a held key
  // (repeat) would then edit the wrong line.
  const apply = (editor: HTMLTextAreaElement, edit: LineEdit) => {
    editor.value = edit.text;
    editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    onChange(edit.text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || event.defaultPrevented) return;
    const editor = event.currentTarget;
    // editor.value, not the prop: on key repeat the prop may be one render behind.
    const text = editor.value;
    const { selectionStart } = editor;
    // Ctrl+Alt is AltGr on ABNT2 keyboards: it types characters, so it is not a shortcut.
    const ctrl = event.ctrlKey && !event.altKey;
    const alt = event.altKey && !event.ctrlKey;
    if (ctrl && event.key.toLowerCase() === "d") {
      event.preventDefault();
      apply(editor, duplicateLine(text, selectionStart));
    } else if (alt && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const edit = moveLine(text, selectionStart, event.key === "ArrowUp" ? "up" : "down");
      if (edit) apply(editor, edit);
    }
  };

  // The click already put the caret where the mouse is: the link is the one around it.
  const onClick = (event: MouseEvent<HTMLTextAreaElement>) => {
    if (!event.ctrlKey || !onOpenLink) return;
    const editor = event.currentTarget;
    const url = findLinkAt(editor.value, editor.selectionStart);
    if (url) {
      event.preventDefault();
      onOpenLink(url);
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
      onClick={onClick}
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
