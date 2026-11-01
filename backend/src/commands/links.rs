//! Link command: the UI never gets the opener plugin, only this validated path.

use tauri::AppHandle;

use crate::error::AppError;
use crate::link;

/// Opens an `http`/`https` URL in the default browser.
#[tauri::command]
pub async fn open_link(app: AppHandle, url: String) -> Result<(), AppError> {
    link::open(&app, &url)
}
