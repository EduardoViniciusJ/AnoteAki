// The only gateway to Rust: contract types and commands (docs/PRD.md §12).
import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type StickerColor = "yellow" | "pink" | "blue" | "green" | "lilac" | "paper";
/** Background opacity, in percent. */
export type StickerOpacity = 100 | 85 | 70;

export interface Note {
  id: number;
  title: string;
  /** Title typed by the user; `""` = the title comes from the body. */
  heading: string;
  body: string;
  color: StickerColor | null;
  opacity: StickerOpacity;
  /** Pinned notes come first in the history. */
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteSummary {
  id: number;
  title: string;
  preview: string;
  color: StickerColor | null;
  pinned: boolean;
  updatedAt: string;
  deletedAt: string | null;
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  shortcut: string;
  hideOnBlur: boolean;
}

export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "DB_ERROR"
  | "SHORTCUT_UNAVAILABLE"
  | "INTERNAL";

export interface AppError {
  code: ErrorCode;
  message: string;
}

export type NoteScope = "active" | "trash";
/** History order. Pinned notes still come first in `active`. */
export type NoteSort = "updated" | "created" | "title";
export type ShowReason = "shortcut" | "tray" | "second-instance";

export interface WindowShownPayload {
  reason: ShowReason;
}

/** What the calling sticky note window shows. */
export interface WindowState {
  noteId: number | null;
  color: StickerColor;
  opacity: StickerOpacity;
  /** Default true: stays on screen when focus leaves the app. */
  pinned: boolean;
}

/** Size presets: 260×220, 340×320 and 460×520 logical px. */
export type WindowSize = "small" | "medium" | "large";

export interface ShortcutStatus {
  shortcut: string;
  registered: boolean;
}

const ERROR_CODES: readonly ErrorCode[] = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "DB_ERROR",
  "SHORTCUT_UNAVAILABLE",
  "INTERNAL",
];

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  const { code, message } = value as Record<string, unknown>;
  return ERROR_CODES.includes(code as ErrorCode) && typeof message === "string";
}

/** Any rejection becomes an `AppError`, so the UI handles a single shape. */
export function toAppError(value: unknown): AppError {
  return isAppError(value) ? value : { code: "INTERNAL", message: "Falha inesperada." };
}

async function call<T>(command: string, args?: InvokeArgs): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toAppError(error);
  }
}

// Notes
export const getLastNote = () => call<Note | null>("get_last_note");
export const getNote = (id: number) => call<Note>("get_note", { id });
export const saveNote = (input: {
  id: number | null;
  body: string;
  heading?: string;
  color?: StickerColor | null;
  opacity?: StickerOpacity;
}) => call<Note>("save_note", input);
export const listNotes = (input: {
  scope: NoteScope;
  /** Only filters `active`; `yellow` also matches notes without a color. */
  color?: StickerColor;
  sort?: NoteSort;
  limit?: number;
  offset?: number;
}) => call<NoteSummary[]>("list_notes", input);
export const searchNotes = (input: { query: string; limit?: number }) =>
  call<NoteSummary[]>("search_notes", input);
export const deleteNote = (id: number) => call<void>("delete_note", { id });
export const restoreNote = (id: number) => call<Note>("restore_note", { id });
export const purgeNote = (id: number) => call<void>("purge_note", { id });
export const setNotePinned = (id: number, pinned: boolean) =>
  call<Note>("set_note_pinned", { id, pinned });
/** Permanently removes every note in the trash. */
export const emptyTrash = () => call<void>("empty_trash");

// Settings and window
export const getSettings = () => call<Settings>("get_settings");
export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
  call<Settings>("set_setting", { key, value });
export const hideWindow = () => call<void>("hide_window");
export const getShortcutStatus = () => call<ShortcutStatus>("get_shortcut_status");
export const getWindowState = () => call<WindowState>("get_window_state");
/** `null` opens a new blank sticky note; an id opens (or focuses) that note. */
export const openNoteWindow = (noteId: number | null) => call<void>("open_note_window", { noteId });
export const closeNoteWindow = () => call<void>("close_note_window");
/** Unpinned sticky notes hide when focus leaves the app (if `hideOnBlur`). */
export const setWindowPinned = (pinned: boolean) => call<void>("set_window_pinned", { pinned });
export const setWindowSize = (size: WindowSize) => call<void>("set_window_size", { size });
/** Opens an http/https URL in the default browser (validated in Rust). */
export const openLink = (url: string) => call<void>("open_link", { url });
/** Move mode for every open sticky note at once: Rust broadcasts `move-mode`. */
export const setMoveMode = (on: boolean) => call<void>("set_move_mode", { on });

// Events (Rust → UI)
export const onWindowShown = (
  handler: (payload: WindowShownPayload) => void,
): Promise<UnlistenFn> =>
  listen<WindowShownPayload>("window-shown", (event) => handler(event.payload));

export interface MoveModePayload {
  on: boolean;
}

export const onMoveMode = (handler: (payload: MoveModePayload) => void): Promise<UnlistenFn> =>
  listen<MoveModePayload>("move-mode", (event) => handler(event.payload));
