import type { EditorFont, Theme } from "./api";

/** "light"/"dark" force a theme; "system" leaves it to prefers-color-scheme (tokens.css). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Local font stacks: nothing is downloaded. */
const EDITOR_FONTS: Record<EditorFont, string> = {
  inter: "var(--font-ui)",
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'Consolas, "Cascadia Mono", monospace',
};

/** The note editor reads `--font-editor` (NoteEditor.css). */
export function applyEditorFont(font: EditorFont) {
  document.documentElement.style.setProperty("--font-editor", EDITOR_FONTS[font]);
}

/** Replays the opening animation of the sticky note (base.css). */
export function playOpen(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("is-opening");
  // Reading the layout restarts the animation when the class comes back.
  void element.offsetWidth;
  element.classList.add("is-opening");
}
