import type { Theme } from "./api";

/** "light"/"dark" force a theme; "system" leaves it to prefers-color-scheme (tokens.css). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Replays the opening animation of the sticky note (base.css). */
export function playOpen(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove("is-opening");
  // Reading the layout restarts the animation when the class comes back.
  void element.offsetWidth;
  element.classList.add("is-opening");
}
