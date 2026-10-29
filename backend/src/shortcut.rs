//! Atalho global (Ctrl+Alt+K) que mostra/esconde a janela principal.
//! Registrado no Rust: o JS não recebe nenhuma permissão do plugin.

use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::window::{self, MAIN, ShowReason};

/// Padrão do contrato. A troca pela tela de Configurações chega no T50.
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+K";

#[derive(Debug, PartialEq, Eq)]
pub enum Toggle {
    Show,
    Hide,
}

/// Só esconde se a janela está visível **e** com foco; visível atrás de outra
/// janela, o atalho a traz para a frente em vez de escondê-la.
pub fn toggle_action(visible: bool, focused: bool) -> Toggle {
    if visible && focused {
        Toggle::Hide
    } else {
        Toggle::Show
    }
}

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            // Só no "pressed": o "released" da mesma tecla alternaria de novo.
            if event.state() == ShortcutState::Pressed {
                toggle(app);
            }
        })
        .build()
}

fn toggle(app: &AppHandle) {
    let Some(main) = app.get_webview_window(MAIN) else {
        return;
    };
    let visible = main.is_visible().unwrap_or(false);
    let focused = main.is_focused().unwrap_or(false);
    let result = match toggle_action(visible, focused) {
        Toggle::Show => window::show(app, ShowReason::Shortcut),
        Toggle::Hide => window::hide(app),
    };
    if result.is_err() {
        eprintln!("AnoteAki: não foi possível alternar a janela.");
    }
}

/// Retorno de `get_shortcut_status`. A UI consulta ao iniciar (um evento emitido
/// antes do `listen()` do JS seria perdido).
#[derive(Clone, Debug, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

/// Registra o atalho padrão e guarda o resultado no estado do app. Se falhar
/// (em uso por outro app), mostra a janela: sem atalho ela ficaria inacessível
/// (a bandeja só chega no T40).
pub fn register(app: &AppHandle) {
    let registered = app.global_shortcut().register(DEFAULT_SHORTCUT).is_ok();
    app.manage(ShortcutStatus {
        shortcut: DEFAULT_SHORTCUT.to_owned(),
        registered,
    });
    if registered {
        return;
    }
    let shown = match app.get_webview_window(MAIN) {
        Some(main) => window::focus(&main),
        None => Ok(()),
    };
    if shown.is_err() {
        eprintln!("AnoteAki: não foi possível mostrar a janela.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hidden_window_is_shown() {
        assert_eq!(toggle_action(false, false), Toggle::Show);
    }

    #[test]
    fn visible_but_unfocused_window_comes_to_front() {
        assert_eq!(toggle_action(true, false), Toggle::Show);
    }

    #[test]
    fn focused_window_is_hidden() {
        assert_eq!(toggle_action(true, true), Toggle::Hide);
    }

    #[test]
    fn status_matches_contract() {
        let json = serde_json::to_string(&ShortcutStatus {
            shortcut: DEFAULT_SHORTCUT.to_owned(),
            registered: false,
        })
        .unwrap();
        assert_eq!(json, r#"{"shortcut":"Ctrl+Alt+K","registered":false}"#);
    }
}
