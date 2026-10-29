//! Note commands (PRD §12). They only forward to `db::notes`, where validation lives.
//! `async` keeps database access off the main (window) thread.

use tauri::{AppHandle, Manager, State, WebviewWindow};

use crate::db::notes::{self, Note, NoteSummary, SaveInput, Scope};
use crate::db::{Db, windows as open_windows};
use crate::error::AppError;
use crate::window::{self, WindowState, Windows};

#[tauri::command]
pub async fn get_last_note(db: State<'_, Db>) -> Result<Option<Note>, AppError> {
    db.with(|conn| notes::get_last(conn))
}

#[tauri::command]
pub async fn get_note(db: State<'_, Db>, id: i64) -> Result<Note, AppError> {
    db.with(|conn| notes::get(conn, id))
}

/// Saves the note of the calling window. A new note is tied to that window,
/// so the window comes back with it after a restart.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn save_note(
    window: WebviewWindow,
    db: State<'_, Db>,
    windows: State<'_, Windows>,
    id: Option<i64>,
    body: String,
    heading: Option<String>,
    color: Option<String>,
    opacity: Option<i64>,
) -> Result<Note, AppError> {
    let input = SaveInput {
        id,
        body: &body,
        heading: heading.as_deref(),
        color: color.as_deref(),
        opacity,
    };
    let note = db.with(|conn| notes::save(conn, input))?;
    if window::is_note_window(window.label()) {
        windows.set(window.label(), WindowState::from(&note))?;
        if id.is_none() {
            window::remember(&db, &window, note.id)?;
        }
    }
    Ok(note)
}

#[tauri::command]
pub async fn list_notes(
    db: State<'_, Db>,
    scope: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    let scope = Scope::parse(&scope)?;
    db.with(|conn| notes::list(conn, scope, limit, offset))
}

#[tauri::command]
pub async fn search_notes(
    db: State<'_, Db>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    db.with(|conn| notes::search(conn, &query, limit))
}

/// Moves a note to the trash and closes its sticky note. If the calling window shows it,
/// that window stays open but forgets the note.
#[tauri::command]
pub async fn delete_note(
    app: AppHandle,
    window: WebviewWindow,
    db: State<'_, Db>,
    windows: State<'_, Windows>,
    id: i64,
) -> Result<(), AppError> {
    db.with(|conn| notes::delete(conn, id))?;
    let Some(label) = windows.label_of(id)? else {
        return Ok(());
    };
    if label == window.label() {
        if let Some(mut state) = windows.state(&label)? {
            state.note_id = None;
            windows.set(&label, state)?;
        }
        return db.with(|conn| open_windows::remove(conn, &label));
    }
    match app.get_webview_window(&label) {
        Some(other) => window::close(&db, &windows, &other),
        None => windows.remove(&label),
    }
}

#[tauri::command]
pub async fn restore_note(db: State<'_, Db>, id: i64) -> Result<Note, AppError> {
    db.with(|conn| notes::restore(conn, id))
}

#[tauri::command]
pub async fn purge_note(db: State<'_, Db>, id: i64) -> Result<(), AppError> {
    db.with(|conn| notes::purge(conn, id))
}
