//! Settings commands (PRD §12). Validation lives in `db::settings` and `shortcut`.

use tauri::{AppHandle, State};

use crate::db::Db;
use crate::db::settings::{self, Change, SettingValue, Settings};
use crate::error::AppError;

#[tauri::command]
pub async fn get_settings(db: State<'_, Db>) -> Result<Settings, AppError> {
    db.with(|conn| settings::load(conn))
}

/// Changes one setting. `shortcut` takes effect right away; if Windows refuses
/// it, the old one stays and the result is `SHORTCUT_UNAVAILABLE`.
#[tauri::command]
pub async fn set_setting(
    app: AppHandle,
    key: String,
    value: SettingValue,
) -> Result<Settings, AppError> {
    crate::settings::apply(&app, Change::parse(&key, value)?)
}
