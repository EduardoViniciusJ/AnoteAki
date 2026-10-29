//! Main window: show it centered on the cursor monitor, focused, and hide it.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

pub const MAIN: &str = "main";

/// Reason sent in the `window-shown` event. `tray` and `second-instance` come in T40/T41.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShowReason {
    Shortcut,
}

#[derive(Clone, Serialize)]
struct WindowShown {
    reason: ShowReason,
}

/// Shows and focuses the window, then tells the UI. The event goes last so the UI
/// focuses the editor only after the window is active.
pub fn show(app: &AppHandle, reason: ShowReason) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(MAIN) else {
        return Ok(());
    };
    focus(&window)?;
    window.emit_to(MAIN, "window-shown", WindowShown { reason })
}

/// Focus sequence: (center if it was hidden) → unminimize → show → set_focus.
pub fn focus<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    if !window.is_visible()? {
        center_on_cursor_monitor(window)?;
    }
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    // The first time a window created hidden is shown, Windows shows it but does not
    // bring it to the front; focusing again on the next event loop turn fixes it.
    let again = window.clone();
    window.run_on_main_thread(move || {
        if again.set_focus().is_err() {
            eprintln!("AnoteAki: não foi possível focar a janela.");
        }
    })
}

pub fn hide(app: &AppHandle) -> tauri::Result<()> {
    match app.get_webview_window(MAIN) {
        Some(window) => window.hide(),
        None => Ok(()),
    }
}

fn center_on_cursor_monitor<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let cursor = window.cursor_position()?;
    let monitor = match window.monitor_from_point(cursor.x, cursor.y)? {
        Some(monitor) => monitor,
        None => match window.primary_monitor()? {
            Some(monitor) => monitor,
            None => return Ok(()),
        },
    };
    let area = monitor.work_area();
    let position = centered(area.position, area.size, window.outer_size()?);
    window.set_position(position)
}

/// Position that centers the window in the monitor work area (without the taskbar).
/// If the window is bigger than the area, it sticks to the top-left corner.
pub fn centered(
    area_position: PhysicalPosition<i32>,
    area_size: PhysicalSize<u32>,
    window: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let offset = |area: u32, win: u32| i32::try_from(area.saturating_sub(win) / 2).unwrap_or(0);
    PhysicalPosition::new(
        area_position.x + offset(area_size.width, window.width),
        area_position.y + offset(area_size.height, window.height),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_inside_work_area() {
        let pos = centered(
            PhysicalPosition::new(0, 0),
            PhysicalSize::new(1920, 1040),
            PhysicalSize::new(360, 320),
        );
        assert_eq!(pos, PhysicalPosition::new(780, 360));
    }

    #[test]
    fn respects_monitor_offset() {
        // Secondary monitor left of the main one (negative coordinates).
        let pos = centered(
            PhysicalPosition::new(-2560, 0),
            PhysicalSize::new(2560, 1400),
            PhysicalSize::new(720, 640),
        );
        assert_eq!(pos, PhysicalPosition::new(-1640, 380));
    }

    #[test]
    fn window_bigger_than_area_sticks_to_corner() {
        let pos = centered(
            PhysicalPosition::new(100, 50),
            PhysicalSize::new(300, 200),
            PhysicalSize::new(360, 320),
        );
        assert_eq!(pos, PhysicalPosition::new(100, 50));
    }

    #[test]
    fn reason_serializes_as_contract() {
        let json = serde_json::to_string(&WindowShown {
            reason: ShowReason::Shortcut,
        })
        .unwrap();
        assert_eq!(json, r#"{"reason":"shortcut"}"#);
    }
}
