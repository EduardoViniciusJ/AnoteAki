// The only gateway to Rust: contract types and commands (docs/PRD.md §12).
import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type StickerColor = "yellow" | "pink" | "blue" | "green" | "lilac" | "paper";

export interface Note {
  id: number;
  title: string;
  body: string;
  color: StickerColor | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteSummary {
  id: number;
  title: string;
  preview: string;
  color: StickerColor | null;
  updatedAt: string;
  deletedAt: string | null;
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  theme: Theme;
  shortcut: string;
  hideOnBlur: boolean;
  autostart: boolean;
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
export type ShowReason = "shortcut" | "tray" | "second-instance";

export interface WindowShownPayload {
  reason: ShowReason;
}

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
export const saveNote = (input: { id: number | null; body: string; color?: StickerColor | null }) =>
  call<Note>("save_note", input);
export const listNotes = (input: { scope: NoteScope; limit?: number; offset?: number }) =>
  call<NoteSummary[]>("list_notes", input);
export const searchNotes = (input: { query: string; limit?: number }) =>
  call<NoteSummary[]>("search_notes", input);
export const deleteNote = (id: number) => call<void>("delete_note", { id });
export const restoreNote = (id: number) => call<Note>("restore_note", { id });
export const purgeNote = (id: number) => call<void>("purge_note", { id });

// Settings and window
export const getSettings = () => call<Settings>("get_settings");
export const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
  call<Settings>("set_setting", { key, value });
export const hideWindow = () => call<void>("hide_window");
export const getShortcutStatus = () => call<ShortcutStatus>("get_shortcut_status");

// Events (Rust → UI)
export const onWindowShown = (
  handler: (payload: WindowShownPayload) => void,
): Promise<UnlistenFn> =>
  listen<WindowShownPayload>("window-shown", (event) => handler(event.payload));
