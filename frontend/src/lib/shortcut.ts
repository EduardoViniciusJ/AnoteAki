// Turns a key press into an accelerator for the global shortcut ("Ctrl+Shift+N").
// The names follow the parser of the global-shortcut plugin; Rust validates again.

export const DEFAULT_SHORTCUT = "Ctrl+Alt+K";

export interface KeyCombo {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** Keys that are accepted as the main key, besides letters, digits and F1–F24. */
const NAMED_KEYS: Record<string, string> = {
  Space: "Space",
  Comma: "Comma",
  Period: "Period",
  Minus: "Minus",
  Equal: "Equal",
  Slash: "Slash",
  Backslash: "Backslash",
  Semicolon: "Semicolon",
  Quote: "Quote",
  Backquote: "Backquote",
  BracketLeft: "BracketLeft",
  BracketRight: "BracketRight",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  Insert: "Insert",
  Delete: "Delete",
};

/** Main key from `KeyboardEvent.code` (layout independent), or null if not usable. */
function mainKey(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter) return letter;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1];
  if (digit) return code.startsWith("Numpad") ? `Num${digit}` : digit;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  return NAMED_KEYS[code] ?? null;
}

/**
 * The accelerator for a key press, or null while only modifiers are held,
 * when there is no modifier, or when the key cannot be a shortcut.
 */
export function shortcutFromKeys(combo: KeyCombo): string | null {
  const key = mainKey(combo.code);
  if (!key) return null;
  const parts = [
    combo.ctrlKey && "Ctrl",
    combo.altKey && "Alt",
    combo.shiftKey && "Shift",
    combo.metaKey && "Super",
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return [...parts, key].join("+");
}

/** How a shortcut is shown to the user: the Windows key is "Win". */
export function displayShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => (part.toLowerCase() === "super" ? "Win" : part))
    .join("+");
}
