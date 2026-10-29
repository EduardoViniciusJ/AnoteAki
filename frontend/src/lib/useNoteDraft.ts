import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Note, saveNote } from "./api";
import { debounce } from "./debounce";

/** Autosave debounce (PRD §12). */
export const SAVE_DELAY_MS = 500;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface NoteDraft {
  /** `null` = draft not created in the database yet. */
  noteId: number | null;
  body: string;
  /** Note in the trash: read-only until restored. */
  readOnly: boolean;
  status: SaveStatus;
  edit: (body: string) => void;
  /** Saves pending changes now. `false` if saving failed (the text stays in the editor). */
  flush: () => Promise<boolean>;
  /** Saves the current note and switches to the one returned by `load` (`null` = new blank note). */
  open: (load: () => Promise<Note | null>) => Promise<boolean>;
  /** Switches notes without saving the current one (e.g. it was just trashed). */
  replace: (note: Note | null) => void;
}

/**
 * Note screen draft with autosave.
 *
 * Saves are chained on a single promise: a `save_note` with `id: null` always finishes
 * (and returns the id) before the next one, so fast typing never creates the same note twice.
 */
export function useNoteDraft(): NoteDraft {
  const [noteId, setNoteId] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs are the source of truth for the save queue; state only feeds the screen.
  const idRef = useRef<number | null>(null);
  const bodyRef = useRef("");
  const dirtyRef = useRef(false);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const editsRef = useRef(0);

  const enqueueSave = useCallback((): Promise<boolean> => {
    if (!dirtyRef.current) return queueRef.current;
    dirtyRef.current = false;
    const job = queueRef.current.then(async () => {
      const id = idRef.current;
      const text = bodyRef.current;
      // The UI only creates a note when there is text (PRD §12, save_note).
      if (id === null && text.trim() === "") {
        setStatus("idle");
        return true;
      }
      try {
        const saved = await saveNote({ id, body: text });
        if (idRef.current === id) {
          idRef.current = saved.id;
          setNoteId(saved.id);
        }
        if (!dirtyRef.current) setStatus("saved");
        return true;
      } catch {
        // Stay dirty: the next keystroke (or flush) tries again.
        dirtyRef.current = true;
        setStatus("error");
        return false;
      }
    });
    queueRef.current = job;
    return job;
  }, []);

  const debouncedSave = useMemo(() => debounce(enqueueSave, SAVE_DELAY_MS), [enqueueSave]);

  const flush = useCallback(() => {
    debouncedSave.cancel();
    return enqueueSave();
  }, [debouncedSave, enqueueSave]);

  const edit = useCallback(
    (next: string) => {
      bodyRef.current = next;
      dirtyRef.current = true;
      editsRef.current += 1;
      setBody(next);
      setStatus("saving");
      debouncedSave();
    },
    [debouncedSave],
  );

  const replace = useCallback(
    (note: Note | null) => {
      debouncedSave.cancel();
      dirtyRef.current = false;
      idRef.current = note?.id ?? null;
      bodyRef.current = note?.body ?? "";
      setNoteId(idRef.current);
      setBody(bodyRef.current);
      setReadOnly(note?.deletedAt != null);
      setStatus("idle");
    },
    [debouncedSave],
  );

  const open = useCallback(
    async (load: () => Promise<Note | null>) => {
      // Repeat while new typing arrives during the save; stop on failure,
      // because switching notes with unsaved text would lose it.
      do {
        if (!(await flush())) return false;
      } while (dirtyRef.current);
      const edits = editsRef.current;
      const note = await load();
      // The user typed while loading: the new text wins over the loaded note.
      if (editsRef.current !== edits) return false;
      replace(note);
      return true;
    },
    [flush, replace],
  );

  // Losing focus saves right away: this makes sure the note is saved before "Quit" in the tray.
  useEffect(() => {
    const onBlur = () => {
      void flush();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [flush]);

  return { noteId, body, readOnly, status, edit, flush, open, replace };
}
