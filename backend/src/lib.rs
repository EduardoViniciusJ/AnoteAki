mod commands;
mod db;
mod shortcut;
mod tray;

/// Monta e executa o app Tauri.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default().run(tauri::generate_context!())
}
