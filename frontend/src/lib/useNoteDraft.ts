import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Note, type StickerColor, type StickerOpacity, saveNote } from "./api";
import { debounce } from "./debounce";

/** Autosave debounce (PRD §12). */
export const SAVE_DELAY_MS = 500;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Color and opacity of a sticky note. */
export interface Look {
  color: StickerColor;
  opacity: StickerOpacity;
}

export const DEFAULT_LOOK: Look = { color: "yellow", opacity: 100 };

export interface NoteDraft {
  /** `null` = draft not created in the database yet. */
  noteId: number | null;
  heading: string;
  body: string;
  look: Look;
  /** Note in the trash: read-only until restored. */
  readOnly: boolean;
  status: SaveStatus;
  edit: (change: { heading?: string; body?: string }) => void;
  setLook: (look: Look) => void;
  /** Saves pending changes now. `false` if saving failed (the text stays in the editor). */
  flush: () => Promise<boolean>;
  /** Shows another note without saving the current one (`null` = blank note with `look`). */
  replace: (note: Note | null, look?: Look) => void;
}

interface Content {
  heading: string;
  body: string;
  look: Look;
}

const EMPTY: Content = { heading: "", body: "", look: DEFAULT_LOOK };

/**
 * Sticky note draft with autosave.
 *
 * Saves are chained on a single promise: a `save_note` with `id: null` always finishes
 * (and returns the id) before the next one, so fast typing never creates the same note twice.
 */
export function useNoteDraft(): NoteDraft {
  const [noteId, setNoteId] = useState<number | null>(null);
  const [content, setContent] = useState<Content>(EMPTY);
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Refs are the source of truth for the save queue; state only feeds the screen.
  const idRef = useRef<number | null>(null);
  const contentRef = useRef<Content>(EMPTY);
  const dirtyRef = useRef(false);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const enqueueSave = useCallback((): Promise<boolean> => {
    if (!dirtyRef.current) return queueRef.current;
    dirtyRef.current = false;
    const job = queueRef.current.then(async () => {
      const id = idRef.current;
      const { heading, body, look } = contentRef.current;
      // A note is only created once the user typed something.
      if (id === null && heading.trim() === "" && body.trim() === "") {
        setStatus("idle");
        return true;
      }
      try {
        const saved = await saveNote({ id, body, heading, ...look });
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

  const change = useCallback(
    (next: Content) => {
      contentRef.current = next;
      dirtyRef.current = true;
      setContent(next);
      setStatus("saving");
      debouncedSave();
    },
    [debouncedSave],
  );

  const edit = useCallback(
    (fields: { heading?: string; body?: string }) => change({ ...contentRef.current, ...fields }),
    [change],
  );

  const setLook = useCallback((look: Look) => change({ ...contentRef.current, look }), [change]);

  const replace = useCallback(
    (note: Note | null, look: Look = contentRef.current.look) => {
      debouncedSave.cancel();
      dirtyRef.current = false;
      idRef.current = note?.id ?? null;
      contentRef.current = note
        ? {
            heading: note.heading,
            body: note.body,
            look: { color: note.color ?? DEFAULT_LOOK.color, opacity: note.opacity },
          }
        : { heading: "", body: "", look };
      setNoteId(idRef.current);
      setContent(contentRef.current);
      setReadOnly(note?.deletedAt != null);
      setStatus("idle");
    },
    [debouncedSave],
  );

  // Losing focus saves right away: this makes sure the note is saved before "Quit" in the tray.
  useEffect(() => {
    const onBlur = () => {
      void flush();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [flush]);

  return {
    noteId,
    heading: content.heading,
    body: content.body,
    look: content.look,
    readOnly,
    status,
    edit,
    setLook,
    flush,
    replace,
  };
}
