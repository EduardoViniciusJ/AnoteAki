//! Global shortcut (Ctrl+Alt+K) that shows/hides all sticky notes.
//! Registered in Rust: the JS side gets no permission for the plugin.

use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::db::Db;
use crate::window::{self, ShowReason, Windows};

/// Contract default. Changing it from the Settings screen comes in T50.
pub const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+K";

#[derive(Debug, PartialEq, Eq)]
pub enum Toggle {
    Show,
    Hide,
}

/// Hide only when a sticky note is visible **and** focused; if they are visible behind
/// another window, the shortcut brings them to the front instead.
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
    let (visible, focused) = window::visibility(app);
    let result = match toggle_action(visible, focused) {
        Toggle::Show => show(app),
        Toggle::Hide => window::hide_all(app, &app.state::<Db>()).map_err(Into::into),
    };
    if result.is_err() {
        eprintln!("AnoteAki: não foi possível alternar as janelas.");
    }
}

fn show(app: &AppHandle) -> Result<(), crate::error::AppError> {
    window::show_all(
        app,
        &app.state::<Db>(),
        &app.state::<Windows>(),
        ShowReason::Shortcut,
    )
}

/// Result of `get_shortcut_status`. The UI asks for it on startup (an event emitted
/// before the JS `listen()` would be lost).
#[derive(Clone, Debug, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

/// Registers the default shortcut and stores the result in app state. If it fails
/// (used by another app), shows the sticky notes: without a shortcut they would be
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
    if show(app).is_err() {
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
