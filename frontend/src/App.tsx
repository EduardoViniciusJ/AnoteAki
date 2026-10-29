import { useCallback, useEffect, useRef, useState } from "react";
import { focusAtEnd } from "./components/NoteEditor";
import { getShortcutStatus, hideWindow, onWindowShown } from "./lib/api";
import { NoteScreen } from "./screens/NoteScreen";

export function App() {
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // O Rust já fez show + set_focus; o rAF espera o WebView pintar antes de focar o editor.
  const focusEditor = useCallback(() => {
    requestAnimationFrame(() => focusAtEnd(editorRef.current));
  }, []);

  useEffect(() => {
    const unlisten = onWindowShown(focusEditor);
    return () => {
      unlisten.then((stop) => stop()).catch(() => {});
    };
  }, [focusEditor]);

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

  return (
    <NoteScreen
      body={body}
      onBodyChange={setBody}
      onEscape={() => {
        hideWindow().catch(() => {
          // Sem como esconder: a janela continua aberta, nada a perder.
        });
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
