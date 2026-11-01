//! Window commands. They are `async` on purpose: creating a window from a sync
//! command deadlocks on Windows (wry #583).

use tauri::{AppHandle, State, WebviewWindow};

use crate::db::Db;
use crate::db::notes;
use crate::error::AppError;
use crate::shortcut::{CurrentShortcut, ShortcutStatus};
use crate::window::{self, WindowSize, WindowState, Windows};

/// Hides every sticky note (used by `Esc`).
#[tauri::command]
pub async fn hide_window(app: AppHandle, db: State<'_, Db>) -> Result<(), AppError> {
    window::hide_all(&app, &db).map_err(AppError::from)
}

/// Current shortcut and whether its global registration worked.
#[tauri::command]
pub fn get_shortcut_status(
    current: State<'_, CurrentShortcut>,
) -> Result<ShortcutStatus, AppError> {
    current.status()
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

/// Pins the calling sticky note on screen (or unpins it, so it hides on blur).
#[tauri::command]
pub async fn set_window_pinned(
    window: WebviewWindow,
    db: State<'_, Db>,
    windows: State<'_, Windows>,
    pinned: bool,
) -> Result<(), AppError> {
    window::set_pinned(&db, &windows, window.label(), pinned)
}

/// Resizes the calling sticky note to a preset: "small", "medium" or "large".
#[tauri::command]
pub async fn set_window_size(
    window: WebviewWindow,
    db: State<'_, Db>,
    size: String,
) -> Result<(), AppError> {
    window::resize(&db, &window, WindowSize::parse(&size)?)
}

/// Turns move mode on or off in every open sticky note at once (Ctrl+M).
#[tauri::command]
pub async fn set_move_mode(app: AppHandle, on: bool) -> Result<(), AppError> {
    window::broadcast_move_mode(&app, on).map_err(AppError::from)
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
