mod commands;
mod db;
mod error;
mod shortcut;
mod tray;
mod window;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, WindowEvent};

/// Opens the database in `%APPDATA%\com.anoteaki.desktop`. If it fails, the app still starts
/// and note commands return `DB_ERROR`, which the UI shows (PRD §8).
fn open_database(app: &AppHandle) -> Option<Connection> {
    let dir = app.path().app_data_dir().ok()?;
    let opened = std::fs::create_dir_all(&dir)
        .ok()
        .and_then(|()| db::open(&dir.join(db::FILE_NAME)).ok());
    if opened.is_none() {
        eprintln!("AnoteAki: não foi possível abrir o banco de dados.");
    }
    opened
}

/// Builds and runs the Tauri app.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(shortcut::plugin())
        .setup(|app| {
            app.manage(db::Db::new(open_database(app.handle())));
            shortcut::register(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Alt+F4 / close only hides; the process lives until "Quit" in the tray (T40).
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.hide().is_err() {
                    eprintln!("AnoteAki: não foi possível esconder a janela.");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::hide_window,
            commands::window::get_shortcut_status,
            commands::notes::get_last_note,
            commands::notes::get_note,
            commands::notes::save_note,
            commands::notes::list_notes,
            commands::notes::search_notes,
            commands::notes::delete_note,
            commands::notes::restore_note,
            commands::notes::purge_note,
        ])
        .run(tauri::generate_context!())
}
