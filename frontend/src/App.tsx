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

  // O Rust já fez show + set_focus; o rAF espera o WebView pintar antes de focar o editor.
  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => focusAtEnd(editorRef.current));
  }, []);

  const showNote = useCallback(
    async (load: () => Promise<Note | null>) => {
      try {
        await open(load);
      } catch {
        // Falha ao ler do banco: fica a nota atual, intacta.
      }
      setScreen("note");
      focusEditor();
    },
    [open, focusEditor],
  );

  // Ao iniciar e a cada vez que a janela aparece na tela Nota: a última nota ativa.
  useEffect(() => {
    void showNote(getLastNote);
    const unlisten = onWindowShown(() => {
      if (screenRef.current === "note") void showNote(getLastNote);
    });
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [showNote]);

  // Consulta (e não evento): um evento emitido antes do listen() seria perdido.
  useEffect(() => {
    let active = true;
    getShortcutStatus()
      .then(({ shortcut, registered }) => {
        if (!active || registered) return;
        // A tela de Configurações (T52) ganha um botão de ação aqui.
        setWarning(`O atalho ${shortcut} está em uso por outro app. Troque-o em Configurações.`);
        focusEditor();
      })
      .catch(() => {
        // Sem o status não há aviso a mostrar; o app segue utilizável.
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
          // A nota aberta foi para a lixeira: salvar nela daria INVALID_INPUT.
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
          // Sem como esconder: a janela continua aberta, nada a perder.
        });
      }}
      onNewNote={() => void showNote(async () => null)}
      onOpenHistory={() => {
        // Salva antes de trocar de tela (PRD §12), para o histórico já listar o texto novo.
        // Se falhar, o texto continua no rascunho e o status mostra o erro.
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
