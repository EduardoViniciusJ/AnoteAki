//! Global shortcut that shows/hides all sticky notes. Registered in Rust: the JS side
//! gets no permission for the plugin. It can be changed at runtime (`set_setting`).

use std::str::FromStr;
use std::sync::Mutex;

use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::db::Db;
use crate::db::settings::DEFAULT_SHORTCUT;
use crate::error::AppError;
use crate::window::{self, ShowReason, Windows};

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

fn show(app: &AppHandle) -> Result<(), AppError> {
    window::show_all(
        app,
        &app.state::<Db>(),
        &app.state::<Windows>(),
        ShowReason::Shortcut,
    )
}

/// Result of `get_shortcut_status`. The UI asks for it on startup (an event emitted
/// before the JS `listen()` would be lost).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}

/// App state: the current shortcut and whether Windows accepted it.
pub struct CurrentShortcut(Mutex<ShortcutStatus>);

impl CurrentShortcut {
    pub fn status(&self) -> Result<ShortcutStatus, AppError> {
        self.0
            .lock()
            .map(|status| status.clone())
            .map_err(|_| AppError::Internal("Falha interna do atalho."))
    }
}

/// Parses an accelerator ("Ctrl+Alt+K"). It needs at least one modifier:
/// a single key would be stolen from every other app.
pub fn parse(text: &str) -> Result<Shortcut, AppError> {
    let shortcut =
        Shortcut::from_str(text).map_err(|_| AppError::InvalidInput("Atalho inválido."))?;
    if shortcut.mods.is_empty() {
        return Err(AppError::InvalidInput(
            "O atalho precisa de Ctrl, Alt, Shift ou Win.",
        ));
    }
    Ok(shortcut)
}

/// Global registration, behind a trait so the change logic is tested without Windows.
pub trait Registrar {
    fn register(&self, shortcut: Shortcut) -> bool;
    fn unregister(&self, shortcut: Shortcut);
}

impl Registrar for AppHandle {
    fn register(&self, shortcut: Shortcut) -> bool {
        self.global_shortcut().register(shortcut).is_ok()
    }

    fn unregister(&self, shortcut: Shortcut) {
        let _ = self.global_shortcut().unregister(shortcut);
    }
}

/// Registers the saved shortcut (or the default, if the saved one is invalid) and
/// stores the result in app state. If it fails (used by another app), shows the
/// sticky notes, so the warning with the way to Settings is seen.
pub fn register(app: &AppHandle, saved: &str) {
    let text = if parse(saved).is_ok() {
        saved
    } else {
        DEFAULT_SHORTCUT
    };
    let registered = parse(text).is_ok_and(|shortcut| app.register(shortcut));
    app.manage(CurrentShortcut(Mutex::new(ShortcutStatus {
        shortcut: text.to_owned(),
        registered,
    })));
    if registered {
        return;
    }
    if show(app).is_err() {
        eprintln!("AnoteAki: não foi possível mostrar a janela.");
    }
}

/// Swaps the shortcut: registers the new one, saves it, then drops the old one.
/// On any failure the old shortcut stays active and nothing is saved.
pub fn change(
    registrar: &impl Registrar,
    current: &CurrentShortcut,
    text: &str,
    save: impl FnOnce() -> Result<(), AppError>,
) -> Result<(), AppError> {
    let new = parse(text)?;
    let mut status = current
        .0
        .lock()
        .map_err(|_| AppError::Internal("Falha interna do atalho."))?;
    let old = parse(&status.shortcut).ok().filter(|_| status.registered);
    if old == Some(new) {
        // Same keys (maybe written differently): nothing to register again.
        save()?;
    } else {
        if !registrar.register(new) {
            return Err(AppError::ShortcutUnavailable);
        }
        if let Err(error) = save() {
            registrar.unregister(new);
            return Err(error);
        }
        if let Some(old) = old {
            registrar.unregister(old);
        }
    }
    *status = ShortcutStatus {
        shortcut: text.to_owned(),
        registered: true,
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use super::*;

    /// Fake registrar: `taken` shortcuts belong to another app.
    #[derive(Default)]
    struct Fake {
        taken: Vec<Shortcut>,
        active: RefCell<Vec<Shortcut>>,
    }

    impl Registrar for Fake {
        fn register(&self, shortcut: Shortcut) -> bool {
            let mut active = self.active.borrow_mut();
            if self.taken.contains(&shortcut) || active.contains(&shortcut) {
                return false;
            }
            active.push(shortcut);
            true
        }

        fn unregister(&self, shortcut: Shortcut) {
            self.active.borrow_mut().retain(|s| *s != shortcut);
        }
    }

    fn key(text: &str) -> Shortcut {
        parse(text).unwrap()
    }

    fn current(shortcut: &str, registered: bool) -> CurrentShortcut {
        CurrentShortcut(Mutex::new(ShortcutStatus {
            shortcut: shortcut.to_owned(),
            registered,
        }))
    }

    fn registered_default() -> (Fake, CurrentShortcut) {
        let fake = Fake::default();
        assert!(fake.register(key(DEFAULT_SHORTCUT)));
        (fake, current(DEFAULT_SHORTCUT, true))
    }

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

    #[test]
    fn parses_accelerators_with_a_modifier() {
        for text in ["Ctrl+Alt+K", "Shift+F2", "Super+Space", "ctrl + shift + n"] {
            assert!(parse(text).is_ok(), "{text}");
        }
    }

    #[test]
    fn rejects_invalid_accelerators() {
        for text in [
            "K",
            "F2",
            "Ctrl+",
            "Ctrl+Alt",
            "Ctrl+K+J",
            "Ctrl+Banana",
            "",
        ] {
            assert_eq!(parse(text).unwrap_err().code(), "INVALID_INPUT", "{text}");
        }
    }

    #[test]
    fn change_swaps_the_registered_shortcut() {
        let (fake, current) = registered_default();
        change(&fake, &current, "Ctrl+Shift+N", || Ok(())).unwrap();
        assert_eq!(*fake.active.borrow(), vec![key("Ctrl+Shift+N")]);
        assert_eq!(
            current.status().unwrap(),
            ShortcutStatus {
                shortcut: "Ctrl+Shift+N".to_owned(),
                registered: true
            }
        );
    }

    #[test]
    fn shortcut_in_use_keeps_the_old_one() {
        let (mut fake, current) = registered_default();
        fake.taken.push(key("Ctrl+Shift+N"));
        let mut saved = false;
        let error = change(&fake, &current, "Ctrl+Shift+N", || {
            saved = true;
            Ok(())
        })
        .unwrap_err();
        assert_eq!(error.code(), "SHORTCUT_UNAVAILABLE");
        assert!(!saved);
        assert_eq!(*fake.active.borrow(), vec![key(DEFAULT_SHORTCUT)]);
        assert_eq!(current.status().unwrap().shortcut, DEFAULT_SHORTCUT);
    }

    #[test]
    fn save_failure_rolls_back() {
        let (fake, current) = registered_default();
        let error = change(&fake, &current, "Ctrl+Shift+N", || Err(AppError::Db("x"))).unwrap_err();
        assert_eq!(error.code(), "DB_ERROR");
        assert_eq!(*fake.active.borrow(), vec![key(DEFAULT_SHORTCUT)]);
        assert_eq!(current.status().unwrap().shortcut, DEFAULT_SHORTCUT);
    }

    #[test]
    fn same_keys_are_not_registered_twice() {
        let (fake, current) = registered_default();
        change(&fake, &current, "Alt+Ctrl+K", || Ok(())).unwrap();
        assert_eq!(*fake.active.borrow(), vec![key(DEFAULT_SHORTCUT)]);
        assert_eq!(current.status().unwrap().shortcut, "Alt+Ctrl+K");
    }

    #[test]
    fn a_failed_startup_shortcut_can_be_retried() {
        let fake = Fake::default();
        let current = current(DEFAULT_SHORTCUT, false);
        change(&fake, &current, DEFAULT_SHORTCUT, || Ok(())).unwrap();
        assert_eq!(*fake.active.borrow(), vec![key(DEFAULT_SHORTCUT)]);
        assert!(current.status().unwrap().registered);
    }

    #[test]
    fn invalid_text_changes_nothing() {
        let (fake, current) = registered_default();
        let error = change(&fake, &current, "K", || Ok(())).unwrap_err();
        assert_eq!(error.code(), "INVALID_INPUT");
        assert_eq!(*fake.active.borrow(), vec![key(DEFAULT_SHORTCUT)]);
    }
}
