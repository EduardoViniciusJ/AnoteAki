import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { IconButton } from "../components/IconButton";
import { NoteListItem, type NoteListItemAction } from "../components/NoteListItem";
import { Toast } from "../components/Toast";
import {
  deleteNote,
  emptyTrash,
  getNote,
  listNotes,
  type Note,
  type NoteScope,
  type NoteSort,
  type NoteSummary,
  purgeNote,
  restoreNote,
  type StickerColor,
  searchNotes,
  setNotePinned,
} from "../lib/api";
import { copyText } from "../lib/clipboard";
import { formatTime, formatWhen, groupByDay } from "../lib/dates";
import "./HistoryScreen.css";

export const PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 200;
export const UNDO_TIMEOUT_MS = 5000;
/** Short confirmations ("Copiado") leave sooner than the undo toast. */
export const INFO_TIMEOUT_MS = 2000;
/** Hover or focus time before the preview opens. */
export const PREVIEW_DELAY_MS = 400;
/** How much of the body the preview shows. */
export const PREVIEW_CHARS = 600;
/** `query` limit in the contract (PRD §12). */
const QUERY_MAX = 200;

type Phase = "loading" | "ready" | "error";

type Notice =
  | { kind: "undo"; note: NoteSummary }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

/** Which destructive action waits in the ConfirmDialog. */
type Confirm =
  | { kind: "purge"; note: NoteSummary }
  | { kind: "bulk-purge"; ids: number[] }
  | { kind: "empty" };

interface Preview {
  noteId: number;
  title: string;
  excerpt: string;
}

const COLOR_NAMES: Record<StickerColor, string> = {
  yellow: "amarelo",
  pink: "rosa",
  blue: "azul",
  green: "verde",
  lilac: "lilás",
  paper: "papel",
};

const SORT_LABELS: Record<NoteSort, string> = {
  updated: "Editadas",
  created: "Criadas",
  title: "Título (A–Z)",
};

/** Clipboard text: typed title, a blank line, then the body (same shape as the Note screen). */
function fullNoteText(note: Note): string {
  const title = note.heading.trim();
  const body = note.body.trim();
  if (!title) return body;
  return body ? `${title}\n\n${body}` : title;
}

export interface HistoryScreenProps {
  /** `Esc` (with an empty search) or the back button. */
  onBack: () => void;
  onOpenNote: (id: number) => void;
  /** The note went to the trash; the Note screen switches notes if it is the open one. */
  onNoteTrashed: (id: number) => void;
}

/** Screen 2 (DESIGN-GUIDELINES → Telas e teclado). */
export function HistoryScreen({ onBack, onOpenNote, onNoteTrashed }: HistoryScreenProps) {
  const [scope, setScope] = useState<NoteScope>("active");
  const [query, setQuery] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [items, setItems] = useState<NoteSummary[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [colorFilter, setColorFilter] = useState<StickerColor | null>(null);
  const [sort, setSort] = useState<NoteSort>("updated");
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [preview, setPreview] = useState<Preview | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  /** After removing an item, focus moves to its neighbor when the list re-renders. */
  const refocusRef = useRef(false);
  /** Start of a Shift+click range. */
  const anchorRef = useRef<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Full notes already fetched for the preview or for copying. */
  const noteCacheRef = useRef(new Map<number, Note>());

  // Search only exists on the Notes tab (`search_notes` only looks at active notes).
  const term = scope === "active" ? query.trim() : "";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), term ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [term]);

  // On the Trash tab the old term does not apply, not even until the debounce clears it.
  const searchTerm = scope === "active" ? debouncedTerm : "";

  const cancelPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    setPreview(null);
  }, []);

  /** Full note, from the session cache or the backend. */
  const fetchNote = async (id: number): Promise<Note> => {
    const cached = noteCacheRef.current.get(id);
    if (cached) return cached;
    const note = await getNote(id);
    noteCacheRef.current.set(id, note);
    return note;
  };

  const schedulePreview = (note: NoteSummary) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      previewTimerRef.current = null;
      fetchNote(note.id)
        .then((full) => {
          setPreview({
            noteId: note.id,
            title: note.title || "Sem título",
            excerpt: [...full.body].slice(0, PREVIEW_CHARS).join(""),
          });
        })
        .catch(() => {
          // Without the note there is nothing to preview.
        });
    }, PREVIEW_DELAY_MS);
  };

  const loadPage = useCallback(
    async (offset: number) => {
      const request = ++requestRef.current;
      if (offset === 0) setPhase("loading");
      try {
        const page = searchTerm
          ? await searchNotes({ query: searchTerm, limit: PAGE_SIZE })
          : await listNotes({
              scope,
              color: scope === "active" ? (colorFilter ?? undefined) : undefined,
              sort,
              limit: PAGE_SIZE,
              offset,
            });
        // An old response (previous search, other tab) does not overwrite the current one.
        if (request !== requestRef.current) return;
        // The notes may have changed: a stale preview or copy would show old text.
        noteCacheRef.current.clear();
        setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
        // `search_notes` does not paginate: it returns everything up to the limit, by relevance.
        setHasMore(!searchTerm && page.length === PAGE_SIZE);
        if (offset === 0) {
          setSelected(0);
          setChecked(new Set());
          anchorRef.current = null;
        }
        setPhase("ready");
      } catch {
        if (request === requestRef.current) setPhase("error");
      }
    },
    [scope, searchTerm, colorFilter, sort],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      await loadPage(items.length);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, items.length, loadPage]);

  // On open, focus goes to the search field.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // A preview timer must not fire after the screen closes.
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (notice?.kind !== "undo" && notice?.kind !== "info") return;
    const timeout = notice.kind === "undo" ? UNDO_TIMEOUT_MS : INFO_TIMEOUT_MS;
    const timer = setTimeout(() => setNotice(null), timeout);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!refocusRef.current) return;
    refocusRef.current = false;
    const id = items[selected]?.id;
    const target = id === undefined ? undefined : itemRefs.current.get(id);
    (target ?? searchRef.current)?.focus();
  }, [items, selected]);

  const focusItem = (index: number) => {
    const note = items[index];
    if (!note) return;
    setSelected(index);
    itemRefs.current.get(note.id)?.focus();
    if (index === items.length - 1) void loadMore();
  };

  const removeFromList = (id: number) => {
    const index = items.findIndex((n) => n.id === id);
    setItems((prev) => prev.filter((n) => n.id !== id));
    setSelected(Math.max(0, Math.min(index, items.length - 2)));
    refocusRef.current = true;
  };

  const trash = async (note: NoteSummary) => {
    removeFromList(note.id);
    try {
      await deleteNote(note.id);
      onNoteTrashed(note.id);
      setNotice({ kind: "undo", note });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível excluir a nota." });
      void loadPage(0);
    }
  };

  const undoTrash = async (note: NoteSummary) => {
    setNotice(null);
    try {
      await restoreNote(note.id);
    } catch {
      setNotice({ kind: "error", message: "Não foi possível desfazer." });
    }
    void loadPage(0);
    searchRef.current?.focus();
  };

  const restore = async (note: NoteSummary) => {
    removeFromList(note.id);
    try {
      await restoreNote(note.id);
      setNotice({ kind: "info", message: "Nota restaurada." });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível restaurar a nota." });
      void loadPage(0);
    }
  };

  const purge = async (note: NoteSummary) => {
    setConfirm(null);
    removeFromList(note.id);
    try {
      await purgeNote(note.id);
    } catch {
      setNotice({ kind: "error", message: "Não foi possível excluir a nota." });
      void loadPage(0);
    }
  };

  const askPurge = (note: NoteSummary) => {
    setNotice(null);
    setConfirm({ kind: "purge", note });
  };

  const togglePin = async (note: NoteSummary) => {
    try {
      await setNotePinned(note.id, !note.pinned);
      await loadPage(0);
    } catch {
      setNotice({ kind: "error", message: "Não foi possível fixar a nota." });
    }
  };

  const copyNote = async (id: number) => {
    try {
      const note = await fetchNote(id);
      await copyText(fullNoteText(note));
      setNotice({ kind: "info", message: "Copiado" });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível copiar." });
    }
  };

  // --- multi-select

  const clearChecked = () => {
    setChecked(new Set());
    anchorRef.current = null;
  };

  const toggleChecked = (id: number, index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchorRef.current = index;
  };

  const checkRange = (index: number) => {
    const anchor = anchorRef.current ?? selected;
    const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
    setChecked(new Set(items.slice(from, to + 1).map((note) => note.id)));
  };

  const onItemClick = (event: MouseEvent, note: NoteSummary, index: number) => {
    if (event.ctrlKey) {
      toggleChecked(note.id, index);
    } else if (event.shiftKey) {
      checkRange(index);
    } else {
      clearChecked();
      onOpenNote(note.id);
    }
  };

  const bulkTrash = async (ids: number[]) => {
    clearChecked();
    try {
      for (const id of ids) {
        await deleteNote(id);
        onNoteTrashed(id);
      }
      setNotice({
        kind: "info",
        message:
          ids.length === 1
            ? "Nota movida para a lixeira."
            : `${ids.length} notas movidas para a lixeira.`,
      });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível excluir as notas." });
    }
    void loadPage(0);
  };

  const bulkRestore = async (ids: number[]) => {
    clearChecked();
    try {
      for (const id of ids) await restoreNote(id);
      setNotice({
        kind: "info",
        message: ids.length === 1 ? "Nota restaurada." : `${ids.length} notas restauradas.`,
      });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível restaurar as notas." });
    }
    void loadPage(0);
  };

  const bulkPurge = async (ids: number[]) => {
    setConfirm(null);
    clearChecked();
    try {
      for (const id of ids) await purgeNote(id);
    } catch {
      setNotice({ kind: "error", message: "Não foi possível excluir as notas." });
    }
    void loadPage(0);
  };

  const doEmptyTrash = async () => {
    setConfirm(null);
    try {
      await emptyTrash();
      setNotice({ kind: "info", message: "Lixeira esvaziada." });
    } catch {
      setNotice({ kind: "error", message: "Não foi possível esvaziar a lixeira." });
    }
    void loadPage(0);
    searchRef.current?.focus();
  };

  const actionsFor = (note: NoteSummary): NoteListItemAction[] =>
    scope === "active"
      ? [
          {
            icon: "pin",
            label: note.pinned ? "Desafixar (P)" : "Fixar (P)",
            onClick: () => void togglePin(note),
          },
          { icon: "copy", label: "Copiar (C)", onClick: () => void copyNote(note.id) },
          { icon: "trash", label: "Excluir (Delete)", onClick: () => void trash(note) },
        ]
      : [
          { icon: "restore", label: "Restaurar", onClick: () => void restore(note) },
          { icon: "copy", label: "Copiar (C)", onClick: () => void copyNote(note.id) },
          {
            icon: "trash",
            label: "Excluir para sempre (Delete)",
            danger: true,
            onClick: () => askPurge(note),
          },
        ];

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = selected;
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(Math.min(index + 1, items.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (index === 0) searchRef.current?.focus();
        else focusItem(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case " ": {
        const note = items[index];
        if (!note) return;
        event.preventDefault();
        toggleChecked(note.id, index);
        break;
      }
      case "Delete": {
        event.preventDefault();
        if (checked.size > 0) {
          const ids = [...checked];
          if (scope === "active") void bulkTrash(ids);
          else setConfirm({ kind: "bulk-purge", ids });
          return;
        }
        const note = items[index];
        if (!note) return;
        if (scope === "active") void trash(note);
        else askPurge(note);
        break;
      }
      case "p":
      case "P": {
        const note = items[index];
        if (!note || !plain || scope !== "active") return;
        event.preventDefault();
        void togglePin(note);
        break;
      }
      case "c":
      case "C": {
        const note = items[index];
        if (!note || !plain) return;
        event.preventDefault();
        void copyNote(note.id);
        break;
      }
    }
  };

  const switchScope = (next: NoteScope) => {
    if (next === scope) return;
    setScope(next);
    setItems([]);
    setNotice(null);
    setConfirm(null);
    clearChecked();
    cancelPreview();
  };

  const now = new Date();
  // Day groups only make sense ordered by edit date; summaries carry no createdAt.
  const grouped = !searchTerm && sort === "updated";
  const renderItem = (note: NoteSummary) => {
    const index = items.indexOf(note);
    return (
      <NoteListItem
        key={note.id}
        ref={(element) => {
          if (element) itemRefs.current.set(note.id, element);
          else itemRefs.current.delete(note.id);
        }}
        note={note}
        when={grouped ? formatTime(note.updatedAt) : formatWhen(note.updatedAt, now)}
        selected={index === selected}
        checked={checked.has(note.id)}
        onFocus={() => {
          setSelected(index);
          schedulePreview(note);
        }}
        onBlur={cancelPreview}
        onHoverChange={(hovering) => {
          if (hovering) schedulePreview(note);
          else cancelPreview();
        }}
        onOpen={(event) => onItemClick(event, note, index)}
        actions={actionsFor(note)}
      />
    );
  };

  // In the active list the pinned notes come first (the backend sorts them first).
  const pinnedItems = scope === "active" && !searchTerm ? items.filter((n) => n.pinned) : [];
  const regularItems = pinnedItems.length > 0 ? items.filter((n) => !n.pinned) : items;

  let body: ReactNode;
  if (phase === "error") {
    body = (
      <div className="history-screen__empty">
        Não foi possível carregar as notas.{" "}
        <button type="button" className="history-screen__retry" onClick={() => void loadPage(0)}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (items.length === 0) {
    let message = "Nenhuma nota ainda.";
    if (phase === "loading") message = "Carregando…";
    else if (searchTerm) message = "Nenhuma nota encontrada.";
    else if (colorFilter) message = "Nenhuma nota com essa cor.";
    else if (scope === "trash") message = "A lixeira está vazia.";
    body = <p className="history-screen__empty">{message}</p>;
  } else {
    const rest = grouped ? (
      groupByDay(regularItems, now).map((group) => (
        <section key={group.key} className="history-screen__group" aria-label={group.label}>
          <h2 className="history-screen__day">{group.label}</h2>
          <ul className="history-screen__items">{group.items.map(renderItem)}</ul>
        </section>
      ))
    ) : (
      <ul className="history-screen__items">{regularItems.map(renderItem)}</ul>
    );
    body = (
      <>
        {pinnedItems.length > 0 && (
          <section className="history-screen__group" aria-label="Fixadas">
            <h2 className="history-screen__day">Fixadas</h2>
            <ul className="history-screen__items">{pinnedItems.map(renderItem)}</ul>
          </section>
        )}
        {rest}
      </>
    );
  }

  const checkedIds = [...checked];
  const confirmMessage =
    confirm?.kind === "purge"
      ? `Excluir "${confirm.note.title || "Sem título"}" para sempre? Não dá para desfazer.`
      : confirm?.kind === "bulk-purge"
        ? `Excluir ${confirm.ids.length} nota(s) para sempre? Não dá para desfazer.`
        : `Esvaziar a lixeira? ${items.length} nota(s) serão excluídas para sempre.`;

  return (
    <section
      className="history-screen screen-enter"
      aria-label="Histórico"
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          // Esc goes one level at a time: preview, selection, then back.
          if (preview) cancelPreview();
          else if (checked.size > 0) clearChecked();
          else onBack();
        } else if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === "f") {
          event.preventDefault();
          switchScope("active");
          searchRef.current?.focus();
        }
      }}
    >
      <header className="history-screen__toolbar" data-tauri-drag-region="">
        <IconButton icon="back" label="Voltar (Esc)" onClick={onBack} />
        <input
          ref={searchRef}
          className="history-screen__search"
          type="search"
          aria-label="Buscar notas"
          placeholder={scope === "active" ? "Buscar…" : "A busca vale só para Notas"}
          maxLength={QUERY_MAX}
          spellCheck={false}
          value={query}
          disabled={scope !== "active"}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              // The first Esc clears the search; the second goes back to the Note.
              event.preventDefault();
              setQuery("");
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(0);
            }
          }}
        />
      </header>
      <div className="history-screen__tabs" role="tablist" aria-label="Escopo">
        {(["active", "trash"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            className="history-screen__tab"
            aria-selected={scope === value}
            onClick={() => switchScope(value)}
          >
            {value === "active" ? "Notas" : "Lixeira"}
          </button>
        ))}
      </div>
      <div className="history-screen__filters">
        {scope === "active" && (
          <fieldset className="history-screen__colors" aria-label="Filtrar por cor">
            {(Object.keys(COLOR_NAMES) as StickerColor[]).map((color) => (
              <button
                key={color}
                type="button"
                className="history-screen__color"
                style={{ background: `var(--sticker-${color})` }}
                aria-label={`Filtrar por ${COLOR_NAMES[color]}`}
                title={`Filtrar por ${COLOR_NAMES[color]}`}
                aria-pressed={colorFilter === color}
                disabled={Boolean(searchTerm)}
                onClick={() => setColorFilter((prev) => (prev === color ? null : color))}
              />
            ))}
          </fieldset>
        )}
        <select
          className="history-screen__sort"
          aria-label="Ordenar"
          value={sort}
          disabled={Boolean(searchTerm)}
          onChange={(event) => setSort(event.target.value as NoteSort)}
        >
          {(Object.keys(SORT_LABELS) as NoteSort[]).map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>
        {scope === "trash" && items.length > 0 && (
          <button
            type="button"
            className="history-screen__empty-trash"
            onClick={() => {
              setNotice(null);
              setConfirm({ kind: "empty" });
            }}
          >
            Esvaziar lixeira
          </button>
        )}
      </div>
      <div
        className="history-screen__list"
        role="tabpanel"
        aria-label={scope === "active" ? "Notas" : "Lixeira"}
        aria-busy={phase === "loading"}
        onKeyDown={onListKeyDown}
        onScroll={(event) => {
          cancelPreview();
          const el = event.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) void loadMore();
        }}
      >
        {body}
      </div>
      {preview && !confirm && checked.size === 0 && (
        <div className="history-screen__preview" role="note" aria-label="Prévia">
          <span className="history-screen__preview-title">{preview.title}</span>
          {preview.excerpt && (
            <span className="history-screen__preview-body">{preview.excerpt}</span>
          )}
        </div>
      )}
      {!confirm && checked.size > 0 && (
        <div className="history-screen__selection" role="toolbar" aria-label="Notas selecionadas">
          <span className="history-screen__selection-count">
            {checked.size === 1 ? "1 selecionada" : `${checked.size} selecionadas`}
          </span>
          {scope === "active" ? (
            <button
              type="button"
              className="history-screen__selection-button"
              onClick={() => void bulkTrash(checkedIds)}
            >
              Excluir ({checked.size})
            </button>
          ) : (
            <>
              <button
                type="button"
                className="history-screen__selection-button"
                onClick={() => void bulkRestore(checkedIds)}
              >
                Restaurar ({checked.size})
              </button>
              <button
                type="button"
                className="history-screen__selection-button history-screen__selection-button--danger"
                onClick={() => setConfirm({ kind: "bulk-purge", ids: checkedIds })}
              >
                Excluir para sempre ({checked.size})
              </button>
            </>
          )}
          <button type="button" className="history-screen__selection-button" onClick={clearChecked}>
            Limpar
          </button>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          message={confirmMessage}
          confirmLabel={confirm.kind === "empty" ? "Esvaziar" : "Excluir"}
          onConfirm={() => {
            if (confirm.kind === "purge") void purge(confirm.note);
            else if (confirm.kind === "bulk-purge") void bulkPurge(confirm.ids);
            else void doEmptyTrash();
          }}
          onCancel={() => {
            setConfirm(null);
            const id = items[selected]?.id;
            (id === undefined ? searchRef.current : itemRefs.current.get(id))?.focus();
          }}
        />
      )}
      {!confirm && notice?.kind === "undo" && (
        <Toast
          message="Nota movida para a lixeira."
          action={{ label: "Desfazer", onClick: () => void undoTrash(notice.note) }}
          onDismiss={() => setNotice(null)}
        />
      )}
      {!confirm && notice && notice.kind !== "undo" && (
        <Toast
          variant={notice.kind === "error" ? "error" : "default"}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}
    </section>
  );
}
