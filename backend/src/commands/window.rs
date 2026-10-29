use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::shortcut::ShortcutStatus;

/// Hides the main window (used by `Esc` on the Note screen).
#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), AppError> {
    crate::window::hide(&app).map_err(AppError::from)
}

/// Current shortcut and whether the global registration worked on startup.
#[tauri::command]
pub fn get_shortcut_status(status: State<'_, ShortcutStatus>) -> ShortcutStatus {
    status.inner().clone()
}
