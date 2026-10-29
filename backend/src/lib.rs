mod commands;
mod db;
mod error;
mod shortcut;
mod tray;
mod window;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, WindowEvent};

/// Abre o banco em `%APPDATA%\com.anoteaki.desktop`. Se falhar, o app abre mesmo assim
/// e os comandos de nota devolvem `DB_ERROR`, que a UI mostra (PRD §8).
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

/// Monta e executa o app Tauri.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(shortcut::plugin())
        .setup(|app| {
            app.manage(db::Db::new(open_database(app.handle())));
            shortcut::register(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Alt+F4 / fechar só esconde; o processo vive até "Sair" na bandeja (T40).
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
