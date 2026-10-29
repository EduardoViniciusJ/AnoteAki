use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::shortcut::ShortcutStatus;

/// Esconde a janela principal (usado pelo `Esc` na tela Nota).
#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), AppError> {
    crate::window::hide(&app).map_err(AppError::from)
}

/// Atalho atual e se o registro global deu certo na inicialização.
#[tauri::command]
pub fn get_shortcut_status(status: State<'_, ShortcutStatus>) -> ShortcutStatus {
    status.inner().clone()
}
