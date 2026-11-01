//! Sticky note windows: create, show and hide them all, and restore them on startup.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl,
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
/// Below the "small" preset (260×220), so every preset fits.
const MIN_WIDTH: f64 = 240.0;
const MIN_HEIGHT: f64 = 200.0;
/// Offset of a new sticky note from the one that opened it, in logical pixels.
const CASCADE: f64 = 32.0;

/// Reason sent in the `window-shown` event.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShowReason {
    Shortcut,
    Tray,
    SecondInstance,
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
    /// Pinned (the default) = stays on screen when focus leaves the app.
    pub pinned: bool,
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
            pinned: true,
        }
    }
}

#[derive(Default)]
struct Registry {
    next_id: u32,
    next_color: usize,
    slots: HashMap<String, WindowState>,
    /// Stacking order, bottom first: the last one used is on top.
    stack: Vec<String>,
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

    /// Adds or updates a window. A new one goes on top of the stack.
    pub fn set(&self, label: &str, state: WindowState) -> Result<(), AppError> {
        self.with(|r| {
            if r.slots.insert(label.to_owned(), state).is_none() {
                r.stack.push(label.to_owned());
            }
        })
    }

    /// Shows `note` in a window, keeping its pinned choice.
    pub fn set_note(&self, label: &str, note: &Note) -> Result<(), AppError> {
        let pinned = self.is_pinned(label)?;
        self.set(
            label,
            WindowState {
                pinned,
                ..WindowState::from(note)
            },
        )
    }

    /// Unknown windows count as pinned, the default.
    pub fn is_pinned(&self, label: &str) -> Result<bool, AppError> {
        self.with(|r| r.slots.get(label).is_none_or(|slot| slot.pinned))
    }

    pub fn set_pinned(&self, label: &str, pinned: bool) -> Result<(), AppError> {
        self.with(|r| match r.slots.get_mut(label) {
            Some(slot) => {
                slot.pinned = pinned;
                Ok(())
            }
            None => Err(AppError::Internal("Janela desconhecida.")),
        })?
    }

    pub fn remove(&self, label: &str) -> Result<(), AppError> {
        self.with(|r| {
            r.slots.remove(label);
            r.stack.retain(|l| l != label);
        })
    }

    /// The focused window moves to the top of the stack.
    pub fn focused(&self, label: &str) -> Result<(), AppError> {
        self.with(|r| {
            if r.slots.contains_key(label) {
                r.stack.retain(|l| l != label);
                r.stack.push(label.to_owned());
            }
        })
    }

    /// Labels from bottom to top.
    fn stack(&self) -> Vec<String> {
        self.with(|r| r.stack.clone()).unwrap_or_default()
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
/// WebView2 browser keys (Ctrl+F find bar, Ctrl+P, F5...) act on the page, not the app.
/// Editing keys (Ctrl+C, Ctrl+V, Ctrl+Z) keep working.
fn disable_browser_keys(window: &WebviewWindow) {
    #[cfg(windows)]
    let done = window.with_webview(|webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
        use windows_core::Interface;
        // SAFETY: COM calls on this window's own WebView2, run on the main thread.
        let result = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| core.Settings())
                .and_then(|settings| settings.cast::<ICoreWebView2Settings3>())
                .and_then(|settings| settings.SetAreBrowserAcceleratorKeysEnabled(false))
        };
        if result.is_err() {
            eprintln!("AnoteAki: não foi possível desligar as teclas do navegador.");
        }
    });
    #[cfg(windows)]
    if done.is_err() {
        eprintln!("AnoteAki: não foi possível desligar as teclas do navegador.");
    }
}

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
    disable_browser_keys(&window);
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
            pinned: true,
        },
    };
    let window = create(app, windows, label, state, None, near)?;
    if let Some(note) = note {
        remember(db, windows, &window, note.id)?;
    }
    Ok(focus(&window)?)
}

/// Saves which note a window shows, so it comes back after a restart.
pub fn remember(
    db: &Db,
    windows: &Windows,
    window: &WebviewWindow,
    note_id: i64,
) -> Result<(), AppError> {
    let open = OpenWindow {
        label: window.label().to_owned(),
        note_id,
        bounds: bounds_of(window)?,
        pinned: windows.is_pinned(window.label())?,
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

/// Puts a window on top of the saved stack, so the order survives a restart.
pub fn save_stack(db: &Db, label: &str) {
    if db.with(|conn| windows::raise(conn, label)).is_err() {
        eprintln!("AnoteAki: não foi possível salvar a ordem das janelas.");
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
        let state = WindowState {
            pinned: saved.pinned,
            ..WindowState::from(&note)
        };
        create(app, windows, saved.label, state, bounds, None)?;
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
    // Show bottom to top, so every sticky note keeps its place in the stack.
    let stacked: Vec<WebviewWindow> = windows
        .stack()
        .iter()
        .filter_map(|label| app.get_webview_window(label))
        .collect();
    for window in &stacked {
        window.unminimize()?;
        window.show()?;
    }
    if let Some(window) = stacked.last() {
        focus(window)?;
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

/// Focus left the app: hide only the unpinned sticky notes.
pub fn hide_unpinned(app: &AppHandle, db: &Db, windows: &Windows) -> Result<(), AppError> {
    for window in note_windows(app) {
        if !windows.is_pinned(window.label())? {
            save_bounds(db, &window);
            window.hide()?;
        }
    }
    Ok(())
}

/// Pins or unpins a sticky note and saves the choice (if it has a note).
pub fn set_pinned(db: &Db, windows: &Windows, label: &str, pinned: bool) -> Result<(), AppError> {
    windows.set_pinned(label, pinned)?;
    db.with(|conn| windows::set_pinned(conn, label, pinned))
}

/// Size presets of a sticky note (PRD §12).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WindowSize {
    Small,
    Medium,
    Large,
}

impl WindowSize {
    pub fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "small" => Ok(Self::Small),
            "medium" => Ok(Self::Medium),
            "large" => Ok(Self::Large),
            _ => Err(AppError::InvalidInput("Tamanho de janela inválido.")),
        }
    }

    /// Width and height in logical pixels.
    pub fn logical(self) -> LogicalSize<f64> {
        match self {
            Self::Small => LogicalSize::new(260.0, 220.0),
            Self::Medium => LogicalSize::new(340.0, 320.0),
            Self::Large => LogicalSize::new(460.0, 520.0),
        }
    }
}

/// Resizes a sticky note to a preset. The top-left corner stays, unless the window
/// would go past the work area: then it moves back just enough.
pub fn resize(db: &Db, window: &WebviewWindow, size: WindowSize) -> Result<(), AppError> {
    let logical = size.logical();
    let physical: PhysicalSize<u32> = logical.to_physical(window.scale_factor()?);
    window.set_size(logical)?;
    let from = window.outer_position()?;
    let to = match window.current_monitor()? {
        Some(monitor) => {
            let area = monitor.work_area();
            fit(from, physical, area.position, area.size)
        }
        None => from,
    };
    if to != from {
        window.set_position(to)?;
    }
    let bounds = Bounds {
        x: to.x,
        y: to.y,
        width: physical.width,
        height: physical.height,
    };
    db.with(|conn| windows::update_bounds(conn, window.label(), bounds))
}

/// Moves a window the minimum needed to stay inside the work area. If it is bigger
/// than the area, it sticks to the top-left corner.
pub fn fit(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    area_position: PhysicalPosition<i32>,
    area_size: PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let axis = |pos: i32, len: u32, start: i32, area: u32| {
        let end = i64::from(start) + i64::from(area);
        let pos = i64::from(pos).min(end - i64::from(len));
        let pos = pos.max(i64::from(start));
        i32::try_from(pos).unwrap_or(start)
    };
    PhysicalPosition::new(
        axis(position.x, size.width, area_position.x, area_size.width),
        axis(position.y, size.height, area_position.y, area_size.height),
    )
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
        let json = serde_json::to_string(&ShowReason::SecondInstance).unwrap();
        assert_eq!(json, r#""second-instance""#);
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
            pinned: true,
        };
        windows.set("note-1", state.clone()).unwrap();
        assert_eq!(windows.label_of(5).unwrap().as_deref(), Some("note-1"));
        assert_eq!(windows.state("note-1").unwrap(), Some(state));
        windows.remove("note-1").unwrap();
        assert_eq!(windows.label_of(5).unwrap(), None);
    }

    #[test]
    fn stack_keeps_the_order_and_focus_moves_to_top() {
        let windows = Windows::default();
        let state = WindowState {
            note_id: None,
            color: "yellow".to_owned(),
            opacity: 100,
            pinned: true,
        };
        for label in ["note-1", "note-2", "note-3"] {
            windows.set(label, state.clone()).unwrap();
        }
        // Updating a window does not move it.
        windows.set("note-1", state).unwrap();
        assert_eq!(windows.stack(), ["note-1", "note-2", "note-3"]);
        windows.focused("note-1").unwrap();
        assert_eq!(windows.stack(), ["note-2", "note-3", "note-1"]);
        windows.remove("note-3").unwrap();
        windows.focused("unknown").unwrap();
        assert_eq!(windows.stack(), ["note-2", "note-1"]);
    }

    #[test]
    fn state_serializes_as_contract() {
        let json = serde_json::to_string(&WindowState {
            note_id: None,
            color: "blue".to_owned(),
            opacity: 70,
            pinned: false,
        })
        .unwrap();
        assert_eq!(
            json,
            r#"{"noteId":null,"color":"blue","opacity":70,"pinned":false}"#
        );
    }

    #[test]
    fn windows_start_pinned_and_keep_it_when_the_note_changes() {
        let windows = Windows::default();
        // Unknown windows count as pinned.
        assert!(windows.is_pinned("note-1").unwrap());
        let state = WindowState {
            note_id: None,
            color: "yellow".to_owned(),
            opacity: 100,
            pinned: true,
        };
        windows.set("note-1", state).unwrap();
        windows.set_pinned("note-1", false).unwrap();
        assert!(!windows.is_pinned("note-1").unwrap());
        assert!(windows.set_pinned("note-9", false).is_err());
        // Saving the note (pinned in the history, a different flag) keeps the window unpinned.
        let note = Note {
            id: 3,
            title: String::new(),
            heading: String::new(),
            body: "a".to_owned(),
            color: None,
            opacity: 100,
            pinned: true,
            created_at: String::new(),
            updated_at: String::new(),
            deleted_at: None,
        };
        windows.set_note("note-1", &note).unwrap();
        let state = windows.state("note-1").unwrap().unwrap();
        assert_eq!((state.note_id, state.pinned), (Some(3), false));
    }

    #[test]
    fn size_presets_follow_the_contract() {
        let sizes: Vec<_> = ["small", "medium", "large"]
            .into_iter()
            .map(|s| WindowSize::parse(s).unwrap().logical())
            .map(|s| (s.width, s.height))
            .collect();
        assert_eq!(sizes, [(260.0, 220.0), (340.0, 320.0), (460.0, 520.0)]);
        for bad in ["", "Small", "huge", "medium "] {
            assert_eq!(WindowSize::parse(bad).unwrap_err().code(), "INVALID_INPUT");
        }
    }

    #[test]
    fn fit_keeps_the_corner_when_the_window_fits() {
        let pos = fit(
            PhysicalPosition::new(100, 200),
            PhysicalSize::new(460, 520),
            PhysicalPosition::new(0, 0),
            PhysicalSize::new(1920, 1040),
        );
        assert_eq!(pos, PhysicalPosition::new(100, 200));
    }

    #[test]
    fn fit_moves_back_only_what_is_needed() {
        let pos = fit(
            PhysicalPosition::new(1700, 900),
            PhysicalSize::new(460, 520),
            PhysicalPosition::new(0, 0),
            PhysicalSize::new(1920, 1040),
        );
        assert_eq!(pos, PhysicalPosition::new(1460, 520));
    }

    #[test]
    fn fit_on_a_monitor_with_negative_coordinates() {
        let pos = fit(
            PhysicalPosition::new(-2600, -10),
            PhysicalSize::new(400, 300),
            PhysicalPosition::new(-2560, 0),
            PhysicalSize::new(2560, 1400),
        );
        assert_eq!(pos, PhysicalPosition::new(-2560, 0));
    }

    #[test]
    fn fit_window_bigger_than_area_sticks_to_corner() {
        let pos = fit(
            PhysicalPosition::new(50, 50),
            PhysicalSize::new(900, 900),
            PhysicalPosition::new(0, 0),
            PhysicalSize::new(800, 600),
        );
        assert_eq!(pos, PhysicalPosition::new(0, 0));
    }
}
