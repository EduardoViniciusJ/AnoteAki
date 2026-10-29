//! Sticky note windows left open, restored on startup.

use rusqlite::{Connection, params};

use crate::error::AppError;

/// Window position and size in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenWindow {
    pub label: String,
    pub note_id: i64,
    pub bounds: Bounds,
}

pub fn list(conn: &Connection) -> Result<Vec<OpenWindow>, AppError> {
    let mut stmt = conn
        .prepare("SELECT label, note_id, x, y, width, height FROM open_windows ORDER BY rowid")?;
    let rows = stmt.query_map([], |row| {
        Ok(OpenWindow {
            label: row.get(0)?,
            note_id: row.get(1)?,
            bounds: Bounds {
                x: row.get(2)?,
                y: row.get(3)?,
                width: row.get(4)?,
                height: row.get(5)?,
            },
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Saves a window and its note. A note lives in one window only.
pub fn upsert(conn: &Connection, window: &OpenWindow) -> Result<(), AppError> {
    let Bounds {
        x,
        y,
        width,
        height,
    } = window.bounds;
    conn.execute(
        "DELETE FROM open_windows WHERE note_id = ?1 AND label <> ?2",
        params![window.note_id, window.label],
    )?;
    conn.execute(
        "INSERT INTO open_windows (label, note_id, x, y, width, height) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6) \
         ON CONFLICT(label) DO UPDATE SET note_id = ?2, x = ?3, y = ?4, width = ?5, height = ?6",
        params![window.label, window.note_id, x, y, width, height],
    )?;
    Ok(())
}

/// Updates only the bounds; does nothing for windows without a saved note.
pub fn update_bounds(conn: &Connection, label: &str, bounds: Bounds) -> Result<(), AppError> {
    conn.execute(
        "UPDATE open_windows SET x = ?2, y = ?3, width = ?4, height = ?5 WHERE label = ?1",
        params![label, bounds.x, bounds.y, bounds.width, bounds.height],
    )?;
    Ok(())
}

pub fn remove(conn: &Connection, label: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM open_windows WHERE label = ?1", [label])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::notes::{self, SaveInput};
    use crate::db::open_in_memory;

    const BOUNDS: Bounds = Bounds {
        x: 10,
        y: -20,
        width: 360,
        height: 320,
    };

    fn note(conn: &Connection) -> i64 {
        notes::save(
            conn,
            SaveInput {
                body: "a",
                ..SaveInput::default()
            },
        )
        .unwrap()
        .id
    }

    fn window(label: &str, note_id: i64) -> OpenWindow {
        OpenWindow {
            label: label.to_owned(),
            note_id,
            bounds: BOUNDS,
        }
    }

    #[test]
    fn saves_updates_and_removes_windows() {
        let conn = open_in_memory();
        let (a, b) = (note(&conn), note(&conn));
        upsert(&conn, &window("note-1", a)).unwrap();
        upsert(&conn, &window("note-2", b)).unwrap();
        let moved = Bounds { x: 50, ..BOUNDS };
        update_bounds(&conn, "note-1", moved).unwrap();
        let open = list(&conn).unwrap();
        assert_eq!(open.len(), 2);
        assert_eq!(open[0].bounds, moved);
        assert_eq!(open[1].note_id, b);
        remove(&conn, "note-1").unwrap();
        assert_eq!(list(&conn).unwrap().len(), 1);
    }

    #[test]
    fn a_note_moves_to_its_new_window() {
        let conn = open_in_memory();
        let a = note(&conn);
        upsert(&conn, &window("note-1", a)).unwrap();
        upsert(&conn, &window("note-2", a)).unwrap();
        let open = list(&conn).unwrap();
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].label, "note-2");
    }

    #[test]
    fn purging_a_note_forgets_its_window() {
        let conn = open_in_memory();
        let a = note(&conn);
        upsert(&conn, &window("note-1", a)).unwrap();
        notes::delete(&conn, a).unwrap();
        notes::purge(&conn, a).unwrap();
        assert!(list(&conn).unwrap().is_empty());
    }
}
