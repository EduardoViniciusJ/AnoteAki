//! Global shortcut (Ctrl+Alt+K) that shows/hides the main window.
//! Registered in Rust: the JS side gets no permission for the plugin.

use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::window::{self, MAIN, ShowReason};

/// Contract default. Changing it from the Settings screen comes in T50.
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+K";

#[derive(Debug, PartialEq, Eq)]
pub enum Toggle {
    Show,
    Hide,
}

/// Hide only when the window is visible **and** focused; if it is visible behind
/// another window, the shortcut brings it to the front instead.
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
            // Only on "pressed": the "released" of the same key would toggle again.
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

/// Result of `get_shortcut_status`. The UI asks for it on startup (an event emitted
/// before the JS `listen()` would be lost).
#[derive(Clone, Debug, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

/// Registers the default shortcut and stores the result in app state. If it fails
/// (used by another app), shows the window: without a shortcut it would be
/// unreachable (the tray only comes in T40).
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
