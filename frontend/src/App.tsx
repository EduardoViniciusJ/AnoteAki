import { useCallback, useEffect, useRef, useState } from "react";
import { focusAtEnd } from "./components/NoteEditor";
import {
  closeNoteWindow,
  getNote,
  getSettings,
  getShortcutStatus,
  getWindowState,
  hideWindow,
  onWindowShown,
  openNoteWindow,
  restoreNote,
} from "./lib/api";
import { applyTheme, playOpen } from "./lib/theme";
import { type Look, useNoteDraft } from "./lib/useNoteDraft";
import { HistoryScreen } from "./screens/HistoryScreen";
import { NoteScreen } from "./screens/NoteScreen";

type Screen = "note" | "history";

/** Paints the sticky note with its color and opacity. */
function applyLook({ color, opacity }: Look) {
  const root = document.documentElement.style;
  root.setProperty("--sticker", `var(--sticker-${color})`);
  root.setProperty("--sticker-opacity", `${opacity}%`);
}

/** One sticky note window. Each window runs its own App. */
export function App() {
  const draft = useNoteDraft();
  const { flush, replace } = draft;
  const [screen, setScreen] = useState<Screen>("note");
  const [warning, setWarning] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Read inside callbacks that must not re-subscribe on every keystroke.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // A blank note starts on the title; a note with text starts at the end of the text.
  // rAF waits for the WebView to paint after Rust did show + set_focus.
  // `target` is given when the note just changed and the screen has not re-rendered yet.
  const focusNote = useCallback((target?: "title" | "body") => {
    requestAnimationFrame(() => {
      const { heading, body } = draftRef.current;
      const where = target ?? (heading || body ? "body" : "title");
      if (where === "title") titleRef.current?.focus();
      else focusAtEnd(editorRef.current);
    });
  }, []);

  useEffect(() => {
    applyLook(draft.look);
  }, [draft.look]);

  // Load the note this window shows.
  useEffect(() => {
    let active = true;
    getWindowState()
      .then(async (state) => {
        const note = state.noteId === null ? null : await getNote(state.noteId);
        if (!active) return;
        replace(note, { color: state.color, opacity: state.opacity });
        focusNote(note && (note.heading || note.body) ? "body" : "title");
      })
      .catch(() => {
        // Without the state the window shows a blank note.
      });
    return () => {
      active = false;
    };
  }, [replace, focusNote]);

  // The theme lives in the settings. Reading it again on focus brings in a change
  // made in another sticky note window.
  useEffect(() => {
    const loadTheme = () => {
      getSettings()
        .then((settings) => applyTheme(settings.theme))
        .catch(() => {
          // Without the settings the theme follows Windows (tokens.css).
        });
    };
    loadTheme();
    window.addEventListener("focus", loadTheme);
    return () => window.removeEventListener("focus", loadTheme);
  }, []);

  useEffect(() => {
    const unlisten = onWindowShown(() => {
      playOpen(document.getElementById("app"));
      focusNote();
    });
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [focusNote]);

  // Query (not an event): an event emitted before listen() would be lost.
  useEffect(() => {
    let active = true;
    getShortcutStatus()
      .then(({ shortcut, registered }) => {
        if (!active || registered) return;
        // The Settings screen (T52) adds an action button here.
        setWarning(`O atalho ${shortcut} está em uso por outro app. Troque-o em Configurações.`);
      })
      .catch(() => {
        // Without the status there is no warning to show; the app still works.
      });
    return () => {
      active = false;
    };
  }, []);

  const backToNote = () => {
    setScreen("note");
    focusNote();
  };

  if (screen === "history") {
    return (
      <HistoryScreen
        onBack={backToNote}
        onOpenNote={(id) => {
          backToNote();
          if (id !== draft.noteId) void openNoteWindow(id).catch(() => {});
        }}
        onNoteTrashed={(id) => {
          // This window's note went to the trash: it becomes a blank sticky note.
          if (draft.noteId === id) replace(null);
        }}
      />
    );
  }

  return (
    <NoteScreen
      heading={draft.heading}
      onHeadingChange={(heading) => draft.edit({ heading })}
      body={draft.body}
      onBodyChange={(body) => draft.edit({ body })}
      look={draft.look}
      onLookChange={draft.setLook}
      status={draft.status}
      readOnly={draft.readOnly}
      onRestore={() => {
        const id = draft.noteId;
        if (id === null) return;
        restoreNote(id)
          .then((note) => {
            replace(note);
            focusNote("body");
          })
          .catch(() => {
            setWarning("Não foi possível restaurar a nota.");
          });
      }}
      onEscape={() => {
        // Could not hide: the windows stay open, nothing is lost.
        void flush().then(() => hideWindow().catch(() => {}));
      }}
      onNewNote={() => {
        void openNoteWindow(null).catch(() => {
          setWarning("Não foi possível abrir uma nota nova.");
        });
      }}
      onClose={() => {
        // Close only after saving, so the text is never lost.
        void flush().then((saved) => {
          if (saved) closeNoteWindow().catch(() => {});
        });
      }}
      onOpenHistory={() => {
        // Save before switching screens (PRD §12) so the history lists the new text.
        // If it fails, the text stays in the draft and the status shows the error.
        void flush().then(() => setScreen("history"));
      }}
      onTitleSubmit={() => focusAtEnd(editorRef.current)}
      warning={warning}
      onDismissWarning={() => {
        setWarning(null);
        focusNote();
      }}
      titleRef={titleRef}
      editorRef={editorRef}
    />
  );
}
