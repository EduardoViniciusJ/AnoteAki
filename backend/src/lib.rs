mod commands;
mod db;
mod error;
mod shortcut;
mod tray;
mod window;

use tauri::WindowEvent;

/// Monta e executa o app Tauri.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(shortcut::plugin())
        .setup(|app| {
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
        ])
        .run(tauri::generate_context!())
}
