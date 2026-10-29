import "./styles/tokens.css";
import "./styles/base.css";
import { getShortcutStatus, hideWindow, onWindowShown } from "./lib/api";
import { createNoteScreen } from "./screens/NoteScreen";

const app = document.querySelector<HTMLElement>("#app");

if (app) {
  const screen = createNoteScreen({
    onEscape: () => {
      hideWindow().catch(() => {
        // Sem como esconder: a janela continua aberta, nada a perder.
      });
    },
  });
  app.append(screen.el);

  // O Rust já fez show + set_focus; o rAF espera o WebView pintar antes de focar o editor.
  void onWindowShown(() => requestAnimationFrame(() => screen.focusEditor()));

  // Consulta (e não evento): um evento emitido antes deste ponto seria perdido.
  getShortcutStatus()
    .then(({ shortcut, registered }) => {
      if (registered) return;
      // A tela de Configurações (T52) ganha um botão de ação aqui.
      screen.showToast({
        variant: "error",
        message: `O atalho ${shortcut} está em uso por outro app. Troque-o em Configurações.`,
      });
      requestAnimationFrame(() => screen.focusEditor());
    })
    .catch(() => {
      // Sem o status não há aviso a mostrar; o app segue utilizável.
    });
}
