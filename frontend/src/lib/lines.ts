// Line operations for the editor (Ctrl+D, Alt+↑/↓). Pure functions over the
// textarea value; the caret line is the line containing `caret`.

export interface LineEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Start and end (exclusive, before the `\n`) of the line containing `caret`. */
function lineBounds(text: string, caret: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", caret - 1) + 1;
  const found = text.indexOf("\n", caret);
  const end = found === -1 ? text.length : found;
  return { start, end };
}

/** Duplicates the caret line below itself; the caret keeps its column, on the copy. */
export function duplicateLine(text: string, caret: number): LineEdit {
  const { start, end } = lineBounds(text, caret);
  const line = text.slice(start, end);
  const position = caret + line.length + 1;
  return {
    text: `${text.slice(0, end)}\n${line}${text.slice(end)}`,
    selectionStart: position,
    selectionEnd: position,
  };
}

/** Swaps the caret line with its neighbor; `null` at the first/last line (no-op). */
export function moveLine(text: string, caret: number, direction: "up" | "down"): LineEdit | null {
  const { start, end } = lineBounds(text, caret);
  const line = text.slice(start, end);
  if (direction === "up") {
    if (start === 0) return null;
    const previousStart = text.lastIndexOf("\n", start - 2) + 1;
    const previous = text.slice(previousStart, start - 1);
    const position = caret - previous.length - 1;
    return {
      text: `${text.slice(0, previousStart)}${line}\n${previous}${text.slice(end)}`,
      selectionStart: position,
      selectionEnd: position,
    };
  }
  if (end === text.length) return null;
  const nextEnd = lineBounds(text, end + 1).end;
  const next = text.slice(end + 1, nextEnd);
  const position = caret + next.length + 1;
  return {
    text: `${text.slice(0, start)}${next}\n${line}${text.slice(nextEnd)}`,
    selectionStart: position,
    selectionEnd: position,
  };
}

/** Inserts `insert` at the caret (replacing the selection); the caret ends after it. */
export function insertText(text: string, start: number, end: number, insert: string): LineEdit {
  const position = start + insert.length;
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selectionStart: position,
    selectionEnd: position,
  };
}
