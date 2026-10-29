//! Tray icon (T40): left click shows the sticky notes; the menu has Open,
//! Start with Windows and Quit.

use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

use crate::db::Db;
use crate::window::{self, ShowReason, Windows};

const OPEN: &str = "open";
const AUTOSTART: &str = "autostart";
const QUIT: &str = "quit";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, OPEN, "Abrir", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        AUTOSTART,
        "Iniciar com o Windows",
        true,
        autostart_enabled(app),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, "Sair", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &autostart, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("AnoteAki")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| on_menu(app, &event, &autostart))
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

fn on_menu(app: &AppHandle, event: &MenuEvent, autostart: &CheckMenuItem<Wry>) {
    match event.id().as_ref() {
        OPEN => show(app),
        AUTOSTART => toggle_autostart(app, autostart),
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

fn autostart_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// The menu already flipped the check mark; apply it, or undo it if Windows refused.
fn toggle_autostart(app: &AppHandle, item: &CheckMenuItem<Wry>) {
    let wanted = item.is_checked().unwrap_or(false);
    let launcher = app.autolaunch();
    let applied = if wanted {
        launcher.enable()
    } else {
        launcher.disable()
    };
    if applied.is_err() {
        eprintln!("AnoteAki: não foi possível alterar o início com o Windows.");
        let _ = item.set_checked(autostart_enabled(app));
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
