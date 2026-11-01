//! Settings that change how the app behaves while it runs (PRD §12).
//! Values live in `db::settings`; this keeps a copy of what event handlers read.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::db::Db;
use crate::db::settings::{self, Change, Settings};
use crate::error::AppError;
use crate::shortcut::{self, CurrentShortcut};
use crate::window;

/// Focus moves between two sticky notes in two steps (one loses it, then the other
/// gets it). Waiting a little avoids hiding everything in the middle of that move.
const BLUR_GRACE: Duration = Duration::from_millis(150);

/// Copy of `hideOnBlur`, read on every focus change without touching the database.
pub struct HideOnBlur(AtomicBool);

impl HideOnBlur {
    pub fn new(on: bool) -> Self {
        Self(AtomicBool::new(on))
    }

    pub fn get(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    fn set(&self, on: bool) {
        self.0.store(on, Ordering::Relaxed);
    }
}

/// Validates, saves and applies one setting, then returns all of them.
pub fn apply(app: &AppHandle, change: Change) -> Result<Settings, AppError> {
    let db = app.state::<Db>();
    match &change {
        Change::Shortcut(text) => {
            shortcut::change(app, &app.state::<CurrentShortcut>(), text, || {
                db.with(|conn| settings::store(conn, &change))
            })?
        }
        Change::HideOnBlur(on) => {
            db.with(|conn| settings::store(conn, &change))?;
            app.state::<HideOnBlur>().set(*on);
        }
        // Theme, font and focus mode are applied by the UI.
        Change::Theme(_) | Change::EditorFont(_) | Change::FocusMode(_) => {
            db.with(|conn| settings::store(conn, &change))?
        }
    }
    db.with(|conn| settings::load(conn))
}

/// A sticky note lost focus: with `hideOnBlur`, hide the unpinned ones, unless
/// focus went to another sticky note. Pinned ones (the default) stay on screen.
pub fn on_blur(app: &AppHandle) {
    if !app.state::<HideOnBlur>().get() {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(BLUR_GRACE);
        let (visible, focused) = window::visibility(&app);
        if visible
            && !focused
            && app.state::<HideOnBlur>().get()
            && window::hide_unpinned(&app, &app.state::<Db>(), &app.state::<window::Windows>())
                .is_err()
        {
            eprintln!("AnoteAki: não foi possível esconder as janelas.");
        }
    });
}
