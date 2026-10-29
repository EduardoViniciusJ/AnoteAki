import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Note, saveNote } from "./api";
import { debounce } from "./debounce";

/** Debounce do autosave (PRD §12, "Responsabilidade do front em relação a salvamento"). */
export const SAVE_DELAY_MS = 500;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface NoteDraft {
  /** `null` = rascunho ainda não criado no banco. */
  noteId: number | null;
  body: string;
  /** Nota da lixeira: só leitura até ser restaurada. */
  readOnly: boolean;
  status: SaveStatus;
  edit: (body: string) => void;
  /** Salva agora o que estiver pendente. `false` se o salvamento falhou (o texto continua no editor). */
  flush: () => Promise<boolean>;
  /** Salva a nota atual e troca pela retornada por `load` (`null` = nota nova em branco). */
  open: (load: () => Promise<Note | null>) => Promise<boolean>;
  /** Troca a nota sem salvar a atual (ex.: ela acabou de ir para a lixeira). */
  replace: (note: Note | null) => void;
}

/**
 * Rascunho da tela Nota com autosave.
 *
 * Os salvamentos são enfileirados numa única promise: um `save_note` com `id: null` sempre termina
 * (e devolve o id) antes do próximo, então digitar rápido nunca cria a mesma nota duas vezes.
 */
export function useNoteDraft(): NoteDraft {
  const [noteId, setNoteId] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Os refs são a verdade para a fila de salvamento; o estado só alimenta a tela.
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
      // O front só cria a nota quando há texto (PRD §12, save_note).
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
        // Fica sujo: a próxima digitação (ou o próximo flush) tenta de novo.
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
      // Repete enquanto houver digitação nova durante o salvamento; para se falhar,
      // porque trocar de nota com o texto não salvo seria perdê-lo.
      do {
        if (!(await flush())) return false;
      } while (dirtyRef.current);
      const edits = editsRef.current;
      const note = await load();
      // Digitou enquanto carregava: o texto novo vale mais que a nota carregada.
      if (editsRef.current !== edits) return false;
      replace(note);
      return true;
    },
    [flush, replace],
  );

  // Perder o foco salva na hora: é o que garante a nota salva antes de "Sair" na bandeja.
  useEffect(() => {
    const onBlur = () => {
      void flush();
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [flush]);

  return { noteId, body, readOnly, status, edit, flush, open, replace };
}
