import {
  type KeyboardEvent,
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
  listNotes,
  type NoteScope,
  type NoteSummary,
  purgeNote,
  restoreNote,
  searchNotes,
} from "../lib/api";
import { formatTime, formatWhen, groupByDay } from "../lib/dates";
import "./HistoryScreen.css";

export const PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 200;
export const UNDO_TIMEOUT_MS = 5000;
/** Limite de `query` no contrato (PRD §12). */
const QUERY_MAX = 200;

type Phase = "loading" | "ready" | "error";

type Notice =
  | { kind: "undo"; note: NoteSummary }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

export interface HistoryScreenProps {
  /** `Esc` (com a busca vazia) ou o botão de voltar. */
  onBack: () => void;
  onOpenNote: (id: number) => void;
  /** A nota foi para a lixeira; a tela Nota troca de nota se for a que está aberta. */
  onNoteTrashed: (id: number) => void;
}

/** Tela 2 (DESIGN-GUIDELINES → Telas e teclado). */
export function HistoryScreen({ onBack, onOpenNote, onNoteTrashed }: HistoryScreenProps) {
  const [scope, setScope] = useState<NoteScope>("active");
  const [query, setQuery] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [items, setItems] = useState<NoteSummary[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<NoteSummary | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  /** Depois de remover um item, o foco vai para o vizinho quando a lista re-renderizar. */
  const refocusRef = useRef(false);

  // A busca só existe na aba Notas (`search_notes` procura só notas ativas).
  const term = scope === "active" ? query.trim() : "";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), term ? SEARCH_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [term]);

  // Na Lixeira o termo antigo não vale, nem durante os ms até o debounce zerá-lo.
  const searchTerm = scope === "active" ? debouncedTerm : "";

  const loadPage = useCallback(
    async (offset: number) => {
      const request = ++requestRef.current;
      if (offset === 0) setPhase("loading");
      try {
        const page = searchTerm
          ? await searchNotes({ query: searchTerm, limit: PAGE_SIZE })
          : await listNotes({ scope, limit: PAGE_SIZE, offset });
        // Uma resposta antiga (busca anterior, outra aba) não sobrescreve a atual.
        if (request !== requestRef.current) return;
        setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
        // `search_notes` não pagina: vem tudo até o limite, por relevância.
        setHasMore(!searchTerm && page.length === PAGE_SIZE);
        if (offset === 0) setSelected(0);
        setPhase("ready");
      } catch {
        if (request === requestRef.current) setPhase("error");
      }
    },
    [scope, searchTerm],
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

  // Ao abrir, o foco vai para a busca.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (notice?.kind !== "undo" && notice?.kind !== "info") return;
    const timer = setTimeout(() => setNotice(null), UNDO_TIMEOUT_MS);
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
    setConfirmPurge(null);
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
    setConfirmPurge(note);
  };

  const actionsFor = (note: NoteSummary): NoteListItemAction[] =>
    scope === "active"
      ? [{ icon: "trash", label: "Excluir (Delete)", onClick: () => void trash(note) }]
      : [
          { icon: "restore", label: "Restaurar", onClick: () => void restore(note) },
          {
            icon: "trash",
            label: "Excluir para sempre (Delete)",
            danger: true,
            onClick: () => askPurge(note),
          },
        ];

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = selected;
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
      case "Delete": {
        const note = items[index];
        if (!note) return;
        event.preventDefault();
        if (scope === "active") void trash(note);
        else askPurge(note);
        break;
      }
    }
  };

  const switchScope = (next: NoteScope) => {
    if (next === scope) return;
    setScope(next);
    setItems([]);
    setNotice(null);
    setConfirmPurge(null);
  };

  const now = new Date();
  const grouped = !searchTerm;
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
        onFocus={() => setSelected(index)}
        onOpen={() => onOpenNote(note.id)}
        actions={actionsFor(note)}
      />
    );
  };

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
    else if (scope === "trash") message = "A lixeira está vazia.";
    body = <p className="history-screen__empty">{message}</p>;
  } else if (grouped) {
    body = groupByDay(items, now).map((group) => (
      <section key={group.key} className="history-screen__group" aria-label={group.label}>
        <h2 className="history-screen__day">{group.label}</h2>
        <ul className="history-screen__items">{group.items.map(renderItem)}</ul>
      </section>
    ));
  } else {
    body = <ul className="history-screen__items">{items.map(renderItem)}</ul>;
  }

  return (
    <section
      className="history-screen"
      aria-label="Histórico"
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
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
              // Primeiro Esc limpa a busca; o segundo volta para a Nota.
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
      <div
        className="history-screen__list"
        role="tabpanel"
        aria-label={scope === "active" ? "Notas" : "Lixeira"}
        aria-busy={phase === "loading"}
        onKeyDown={onListKeyDown}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) void loadMore();
        }}
      >
        {body}
      </div>
      {confirmPurge && (
        <ConfirmDialog
          message={`Excluir "${confirmPurge.title || "Sem título"}" para sempre? Não dá para desfazer.`}
          confirmLabel="Excluir"
          onConfirm={() => void purge(confirmPurge)}
          onCancel={() => {
            setConfirmPurge(null);
            const id = items[selected]?.id;
            (id === undefined ? searchRef.current : itemRefs.current.get(id))?.focus();
          }}
        />
      )}
      {!confirmPurge && notice?.kind === "undo" && (
        <Toast
          message="Nota movida para a lixeira."
          action={{ label: "Desfazer", onClick: () => void undoTrash(notice.note) }}
          onDismiss={() => setNotice(null)}
        />
      )}
      {!confirmPurge && notice && notice.kind !== "undo" && (
        <Toast
          variant={notice.kind === "error" ? "error" : "default"}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}
    </section>
  );
}
