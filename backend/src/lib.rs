mod commands;
mod db;
mod error;
mod shortcut;
mod tray;
mod window;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

use crate::db::Db;
use crate::window::{ShowReason, Windows};

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
        // Must be the first plugin: a second launch stops here and wakes the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let shown = window::show_all(
                app,
                &app.state::<Db>(),
                &app.state::<Windows>(),
                ShowReason::SecondInstance,
            );
            if shown.is_err() {
                eprintln!("AnoteAki: não foi possível mostrar as notas.");
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(shortcut::plugin())
        .setup(|app| {
            app.manage(Db::new(open_database(app.handle())));
            app.manage(Windows::default());
            let handle = app.handle();
            if window::restore(handle, &handle.state::<Db>(), &handle.state::<Windows>()).is_err() {
                eprintln!("AnoteAki: não foi possível reabrir as notas.");
            }
            shortcut::register(handle);
            tray::create(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();
            match event {
                // Alt+F4 / close hides all sticky notes, like Esc; the process lives
                // until "Sair" in the tray.
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    if window::hide_all(app, &app.state::<Db>()).is_err() {
                        eprintln!("AnoteAki: não foi possível esconder as janelas.");
                    }
                }
                WindowEvent::Focused(true) => {
                    let _ = app.state::<Windows>().focused(window.label());
                    window::save_stack(&app.state::<Db>(), window.label());
                }
                // Losing focus is the end of a drag or resize: save where the note is.
                WindowEvent::Focused(false) => {
                    if let Some(note) = app.get_webview_window(window.label()) {
                        window::save_bounds(&app.state::<Db>(), &note);
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::window::hide_window,
            commands::window::get_shortcut_status,
            commands::window::get_window_state,
            commands::window::open_note_window,
            commands::window::close_note_window,
            commands::notes::get_last_note,
            commands::notes::get_note,
            commands::notes::save_note,
            commands::notes::list_notes,
            commands::notes::search_notes,
            commands::notes::delete_note,
            commands::notes::restore_note,
            commands::notes::purge_note,
        ])
        .build(tauri::generate_context!())?
        .run(|_app, event| {
            // Closing the last sticky note must not quit: the shortcut opens a new one.
            // Only an explicit exit (code set, e.g. "Quit" in the tray, T40) ends the process.
            if let RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
            }
        });
    Ok(())
}
