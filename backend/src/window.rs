//! Sticky note windows: create, show and hide them all, and restore them on startup.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder,
};

use crate::db::Db;
use crate::db::notes::{self, Note};
use crate::db::windows::{self, Bounds, OpenWindow};
use crate::error::AppError;

pub const LABEL_PREFIX: &str = "note-";
/// Colors given to new sticky notes, in turn.
pub const COLOR_ROTATION: [&str; 4] = ["yellow", "pink", "blue", "green"];
const WIDTH: f64 = 360.0;
const HEIGHT: f64 = 320.0;
const MIN_WIDTH: f64 = 280.0;
const MIN_HEIGHT: f64 = 200.0;
/// Offset of a new sticky note from the one that opened it, in logical pixels.
const CASCADE: f64 = 32.0;

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

/// What a sticky note window shows. Returned by `get_window_state`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    /// `None` = a blank sticky note not saved yet.
    pub note_id: Option<i64>,
    pub color: String,
    pub opacity: i64,
}

impl From<&Note> for WindowState {
    fn from(note: &Note) -> Self {
        Self {
            note_id: Some(note.id),
            color: note
                .color
                .clone()
                .unwrap_or_else(|| COLOR_ROTATION[0].to_owned()),
            opacity: note.opacity,
        }
    }
}

#[derive(Default)]
struct Registry {
    next_id: u32,
    next_color: usize,
    slots: HashMap<String, WindowState>,
    last_focused: Option<String>,
}

/// In-memory list of sticky note windows, managed by Tauri.
#[derive(Default)]
pub struct Windows(Mutex<Registry>);

impl Windows {
    fn with<T>(&self, f: impl FnOnce(&mut Registry) -> T) -> Result<T, AppError> {
        let mut registry = self
            .0
            .lock()
            .map_err(|_| AppError::Internal("Falha interna das janelas."))?;
        Ok(f(&mut registry))
    }

    pub fn state(&self, label: &str) -> Result<Option<WindowState>, AppError> {
        self.with(|r| r.slots.get(label).cloned())
    }

    pub fn label_of(&self, note_id: i64) -> Result<Option<String>, AppError> {
        self.with(|r| {
            r.slots
                .iter()
                .find(|(_, slot)| slot.note_id == Some(note_id))
                .map(|(label, _)| label.clone())
        })
    }

    pub fn set(&self, label: &str, state: WindowState) -> Result<(), AppError> {
        self.with(|r| {
            r.slots.insert(label.to_owned(), state);
        })
    }

    pub fn remove(&self, label: &str) -> Result<(), AppError> {
        self.with(|r| {
            r.slots.remove(label);
        })
    }

    pub fn focused(&self, label: &str) -> Result<(), AppError> {
        self.with(|r| r.last_focused = Some(label.to_owned()))
    }

    fn last_focused(&self) -> Option<String> {
        self.with(|r| r.last_focused.clone()).ok().flatten()
    }

    fn next_label(&self) -> Result<String, AppError> {
        self.with(|r| {
            r.next_id += 1;
            format!("{LABEL_PREFIX}{}", r.next_id)
        })
    }

    fn next_color(&self) -> Result<String, AppError> {
        self.with(|r| {
            let color = rotation_color(r.next_color);
            r.next_color += 1;
            color.to_owned()
        })
    }

    /// Labels restored from the database must not be reused.
    fn reserve(&self, label: &str) -> Result<(), AppError> {
        let id = label_number(label).unwrap_or(0);
        self.with(|r| r.next_id = r.next_id.max(id))
    }
}

pub fn rotation_color(index: usize) -> &'static str {
    COLOR_ROTATION[index % COLOR_ROTATION.len()]
}

fn label_number(label: &str) -> Option<u32> {
    label.strip_prefix(LABEL_PREFIX)?.parse().ok()
}

pub fn is_note_window(label: &str) -> bool {
    label.starts_with(LABEL_PREFIX)
}

fn note_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| is_note_window(label))
        .map(|(_, window)| window)
        .collect()
}

pub fn bounds_of<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<Bounds> {
    let position = window.outer_position()?;
    let size = window.inner_size()?;
    Ok(Bounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

/// Creates a hidden sticky note window. Without `bounds` it opens next to `near`,
/// or centered on the cursor monitor.
fn create(
    app: &AppHandle,
    windows: &Windows,
    label: String,
    state: WindowState,
    bounds: Option<Bounds>,
    near: Option<&WebviewWindow>,
) -> Result<WebviewWindow, AppError> {
    // Registered before the page loads, so `get_window_state` always finds it.
    windows.set(&label, state)?;
    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("AnoteAki")
        .inner_size(WIDTH, HEIGHT)
        .min_inner_size(MIN_WIDTH, MIN_HEIGHT)
        .resizable(true)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;
    match (bounds, near) {
        (Some(bounds), _) => {
            window.set_size(PhysicalSize::new(bounds.width, bounds.height))?;
            window.set_position(PhysicalPosition::new(bounds.x, bounds.y))?;
        }
        (None, Some(near)) => {
            let offset = (CASCADE * near.scale_factor()?).round() as i32;
            let from = near.outer_position()?;
            window.set_position(cascade(from, offset))?;
        }
        (None, None) => center_on_cursor_monitor(&window)?,
    }
    Ok(window)
}

/// Position of a new sticky note next to the one that opened it.
pub fn cascade(from: PhysicalPosition<i32>, offset: i32) -> PhysicalPosition<i32> {
    PhysicalPosition::new(from.x + offset, from.y + offset)
}

/// Opens a sticky note (`note = None` = a new blank one) next to `near` and focuses it.
/// A note already open in another window just brings that window to the front.
pub fn open(
    app: &AppHandle,
    db: &Db,
    windows: &Windows,
    note: Option<&Note>,
    near: Option<&WebviewWindow>,
) -> Result<(), AppError> {
    if let Some(note) = note
        && let Some(label) = windows.label_of(note.id)?
        && let Some(window) = app.get_webview_window(&label)
    {
        return Ok(focus(&window)?);
    }
    let label = windows.next_label()?;
    let state = match note {
        Some(note) => WindowState::from(note),
        None => WindowState {
            note_id: None,
            color: windows.next_color()?,
            opacity: 100,
        },
    };
    let window = create(app, windows, label, state, None, near)?;
    if let Some(note) = note {
        remember(db, &window, note.id)?;
    }
    Ok(focus(&window)?)
}

/// Saves which note a window shows, so it comes back after a restart.
pub fn remember(db: &Db, window: &WebviewWindow, note_id: i64) -> Result<(), AppError> {
    let open = OpenWindow {
        label: window.label().to_owned(),
        note_id,
        bounds: bounds_of(window)?,
    };
    db.with(|conn| windows::upsert(conn, &open))
}

/// Saves the position and size of a window that has a note.
pub fn save_bounds(db: &Db, window: &WebviewWindow) {
    let saved = bounds_of(window)
        .map_err(AppError::from)
        .and_then(|bounds| db.with(|conn| windows::update_bounds(conn, window.label(), bounds)));
    if saved.is_err() {
        eprintln!("AnoteAki: não foi possível salvar a posição da janela.");
    }
}

/// Recreates the windows left open last time (hidden, like the app starts).
pub fn restore(app: &AppHandle, db: &Db, windows: &Windows) -> Result<(), AppError> {
    let open = db.with(|conn| windows::list(conn))?;
    for saved in open {
        windows.reserve(&saved.label)?;
        let Ok(note) = db.with(|conn| notes::get(conn, saved.note_id)) else {
            continue;
        };
        let bounds = on_screen(app, saved.bounds).then_some(saved.bounds);
        create(
            app,
            windows,
            saved.label,
            WindowState::from(&note),
            bounds,
            None,
        )?;
    }
    Ok(())
}

/// False if a monitor was unplugged and the window would open off screen.
fn on_screen(app: &AppHandle, bounds: Bounds) -> bool {
    let Ok(monitors) = app.available_monitors() else {
        return true;
    };
    monitors.iter().any(|monitor| {
        let (pos, size) = (monitor.position(), monitor.size());
        inside(bounds.x, bounds.y, *pos, *size)
    })
}

pub fn inside(x: i32, y: i32, pos: PhysicalPosition<i32>, size: PhysicalSize<u32>) -> bool {
    let right = i64::from(pos.x) + i64::from(size.width);
    let bottom = i64::from(pos.y) + i64::from(size.height);
    i64::from(x) >= i64::from(pos.x)
        && i64::from(x) < right
        && i64::from(y) >= i64::from(pos.y)
        && i64::from(y) < bottom
}

/// True if any sticky note is visible, and true if any has focus.
pub fn visibility(app: &AppHandle) -> (bool, bool) {
    let all = note_windows(app);
    let visible = all.iter().any(|w| w.is_visible().unwrap_or(false));
    let focused = all.iter().any(|w| w.is_focused().unwrap_or(false));
    (visible, focused)
}

/// Shows every sticky note and focuses the last one used. With none open,
/// opens the last note (or a blank one).
pub fn show_all(
    app: &AppHandle,
    db: &Db,
    windows: &Windows,
    reason: ShowReason,
) -> Result<(), AppError> {
    let all = note_windows(app);
    if all.is_empty() {
        let last = db.with(|conn| notes::get_last(conn)).ok().flatten();
        open(app, db, windows, last.as_ref(), None)?;
    }
    let all = note_windows(app);
    for window in &all {
        window.unminimize()?;
        window.show()?;
    }
    let target = windows
        .last_focused()
        .and_then(|label| app.get_webview_window(&label))
        .or_else(|| all.last().cloned());
    if let Some(window) = target {
        focus(&window)?;
        window.emit_to(window.label(), "window-shown", WindowShown { reason })?;
    }
    Ok(())
}

pub fn hide_all(app: &AppHandle, db: &Db) -> tauri::Result<()> {
    for window in note_windows(app) {
        save_bounds(db, &window);
        window.hide()?;
    }
    Ok(())
}

/// Closes one sticky note for good. Its note stays in the history.
pub fn close(db: &Db, windows: &Windows, window: &WebviewWindow) -> Result<(), AppError> {
    let label = window.label().to_owned();
    windows.remove(&label)?;
    db.with(|conn| windows::remove(conn, &label))?;
    Ok(window.destroy()?)
}

/// Focus sequence: unminimize → show → set_focus.
pub fn focus<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
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

    #[test]
    fn new_notes_rotate_four_colors() {
        let colors: Vec<_> = (0..5).map(rotation_color).collect();
        assert_eq!(colors, ["yellow", "pink", "blue", "green", "yellow"]);
    }

    #[test]
    fn new_note_opens_down_and_right() {
        let pos = cascade(PhysicalPosition::new(100, -50), 48);
        assert_eq!(pos, PhysicalPosition::new(148, -2));
    }

    #[test]
    fn detects_windows_off_screen() {
        let (pos, size) = (
            PhysicalPosition::new(-1920, 0),
            PhysicalSize::new(1920, 1080),
        );
        assert!(inside(-100, 10, pos, size));
        assert!(!inside(10, 10, pos, size));
        assert!(!inside(-100, 1080, pos, size));
    }

    #[test]
    fn labels_are_numbered_and_restored_ones_are_skipped() {
        let windows = Windows::default();
        windows.reserve("note-7").unwrap();
        assert_eq!(windows.next_label().unwrap(), "note-8");
        assert!(is_note_window("note-8"));
        assert!(!is_note_window("main"));
    }

    #[test]
    fn finds_the_window_of_a_note() {
        let windows = Windows::default();
        let state = WindowState {
            note_id: Some(5),
            color: "pink".to_owned(),
            opacity: 85,
        };
        windows.set("note-1", state.clone()).unwrap();
        assert_eq!(windows.label_of(5).unwrap().as_deref(), Some("note-1"));
        assert_eq!(windows.state("note-1").unwrap(), Some(state));
        windows.remove("note-1").unwrap();
        assert_eq!(windows.label_of(5).unwrap(), None);
    }

    #[test]
    fn state_serializes_as_contract() {
        let json = serde_json::to_string(&WindowState {
            note_id: None,
            color: "blue".to_owned(),
            opacity: 70,
        })
        .unwrap();
        assert_eq!(json, r#"{"noteId":null,"color":"blue","opacity":70}"#);
    }
}
