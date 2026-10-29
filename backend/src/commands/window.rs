//! Window commands. They are `async` on purpose: creating a window from a sync
//! command deadlocks on Windows (wry #583).

use tauri::{AppHandle, State, WebviewWindow};

use crate::db::Db;
use crate::db::notes;
use crate::error::AppError;
use crate::shortcut::ShortcutStatus;
use crate::window::{self, WindowState, Windows};

/// Hides every sticky note (used by `Esc`).
#[tauri::command]
pub async fn hide_window(app: AppHandle, db: State<'_, Db>) -> Result<(), AppError> {
    window::hide_all(&app, &db).map_err(AppError::from)
}

/// Current shortcut and whether the global registration worked on startup.
#[tauri::command]
pub fn get_shortcut_status(status: State<'_, ShortcutStatus>) -> ShortcutStatus {
    status.inner().clone()
}

/// Which note, color and opacity the calling window shows.
#[tauri::command]
pub async fn get_window_state(
    window: WebviewWindow,
    windows: State<'_, Windows>,
) -> Result<WindowState, AppError> {
    windows
        .state(window.label())?
        .ok_or(AppError::Internal("Janela desconhecida."))
}

/// Opens a sticky note next to the calling one: a new blank note (`noteId: null`)
/// or an existing note, which is only focused if it is already open.
#[tauri::command]
pub async fn open_note_window(
    app: AppHandle,
    window: WebviewWindow,
    db: State<'_, Db>,
    windows: State<'_, Windows>,
    note_id: Option<i64>,
) -> Result<(), AppError> {
    let note = match note_id {
        Some(id) => Some(db.with(|conn| notes::get(conn, id))?),
        None => None,
    };
    window::open(&app, &db, &windows, note.as_ref(), Some(&window))
}

/// Closes the calling sticky note. Its note stays in the history.
#[tauri::command]
pub async fn close_note_window(
    window: WebviewWindow,
    db: State<'_, Db>,
    windows: State<'_, Windows>,
) -> Result<(), AppError> {
    window::close(&db, &windows, &window)
}
