//! Tray icon (T40): left click shows the sticky notes; the menu has Open and Quit.
//! Start with Windows is chosen in the installer and managed in Task Manager.

use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::db::Db;
use crate::window::{self, ShowReason, Windows};

const OPEN: &str = "open";
const QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, OPEN, "Abrir", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, "Sair", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("AnoteAki")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu)
        .on_tray_icon_event(on_icon);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

fn on_icon(tray: &TrayIcon<Wry>, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        show(tray.app_handle());
    }
}

fn on_menu(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        OPEN => show(app),
        QUIT => quit(app),
        _ => {}
    }
}

fn show(app: &AppHandle) {
    let shown = window::show_all(
        app,
        &app.state::<Db>(),
        &app.state::<Windows>(),
        ShowReason::Tray,
    );
    if shown.is_err() {
        eprintln!("AnoteAki: não foi possível mostrar as notas.");
    }
}

/// Saves where every sticky note is, then ends the process. The text is already
/// saved: opening the tray menu takes focus from the note, which flushes it.
fn quit(app: &AppHandle) {
    if window::hide_all(app, &app.state::<Db>()).is_err() {
        eprintln!("AnoteAki: não foi possível salvar as janelas.");
    }
    app.exit(0);
}
