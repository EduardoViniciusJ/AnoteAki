import { useCallback, useEffect, useRef, useState } from "react";
import { focusAtEnd } from "./components/NoteEditor";
import {
  getLastNote,
  getNote,
  getShortcutStatus,
  hideWindow,
  type Note,
  onWindowShown,
  restoreNote,
} from "./lib/api";
import { useNoteDraft } from "./lib/useNoteDraft";
import { HistoryScreen } from "./screens/HistoryScreen";
import { NoteScreen } from "./screens/NoteScreen";

type Screen = "note" | "history";

export function App() {
  const draft = useNoteDraft();
  const { flush, open, replace } = draft;
  const [screen, setScreen] = useState<Screen>("note");
  const [warning, setWarning] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const screenRef = useRef<Screen>("note");
  screenRef.current = screen;

  // Rust already did show + set_focus; rAF waits for the WebView to paint before focusing.
  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => focusAtEnd(editorRef.current));
  }, []);

  const showNote = useCallback(
    async (load: () => Promise<Note | null>) => {
      try {
        await open(load);
      } catch {
        // Could not read from the database: keep the current note as is.
      }
      setScreen("note");
      focusEditor();
    },
    [open, focusEditor],
  );

  // On startup and every time the window shows on the Note screen: load the last active note.
  useEffect(() => {
    void showNote(getLastNote);
    const unlisten = onWindowShown(() => {
      if (screenRef.current === "note") void showNote(getLastNote);
    });
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [showNote]);

  // Query (not an event): an event emitted before listen() would be lost.
  useEffect(() => {
    let active = true;
    getShortcutStatus()
      .then(({ shortcut, registered }) => {
        if (!active || registered) return;
        // The Settings screen (T52) adds an action button here.
        setWarning(`O atalho ${shortcut} está em uso por outro app. Troque-o em Configurações.`);
        focusEditor();
      })
      .catch(() => {
        // Without the status there is no warning to show; the app still works.
      });
    return () => {
      active = false;
    };
  }, [focusEditor]);

  if (screen === "history") {
    return (
      <HistoryScreen
        onBack={() => {
          setScreen("note");
          focusEditor();
        }}
        onOpenNote={(id) => void showNote(() => getNote(id))}
        onNoteTrashed={(id) => {
          // The open note went to the trash: saving it would return INVALID_INPUT.
          if (draft.noteId === id) replace(null);
        }}
      />
    );
  }

  return (
    <NoteScreen
      body={draft.body}
      onBodyChange={draft.edit}
      status={draft.status}
      readOnly={draft.readOnly}
      onRestore={() => {
        const id = draft.noteId;
        if (id === null) return;
        restoreNote(id)
          .then((note) => {
            replace(note);
            focusEditor();
          })
          .catch(() => {
            setWarning("Não foi possível restaurar a nota.");
          });
      }}
      onEscape={() => {
        hideWindow().catch(() => {
          // Could not hide: the window stays open, nothing is lost.
        });
      }}
      onNewNote={() => void showNote(async () => null)}
      onOpenHistory={() => {
        // Save before switching screens (PRD §12) so the history lists the new text.
        // If it fails, the text stays in the draft and the status shows the error.
        void flush().then(() => setScreen("history"));
      }}
      warning={warning}
      onDismissWarning={() => {
        setWarning(null);
        focusEditor();
      }}
      editorRef={editorRef}
    />
  );
}
