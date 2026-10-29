//! Comandos de notas (PRD §12). Só repassam para `db::notes`, onde fica a validação.
//! `async` tira o acesso ao banco da thread principal (a da janela).

use tauri::State;

use crate::db::Db;
use crate::db::notes::{self, Note, NoteSummary, Scope};
use crate::error::AppError;

#[tauri::command]
pub async fn get_last_note(db: State<'_, Db>) -> Result<Option<Note>, AppError> {
    db.with(|conn| notes::get_last(conn))
}

#[tauri::command]
pub async fn get_note(db: State<'_, Db>, id: i64) -> Result<Note, AppError> {
    db.with(|conn| notes::get(conn, id))
}

#[tauri::command]
pub async fn save_note(
    db: State<'_, Db>,
    id: Option<i64>,
    body: String,
    color: Option<String>,
) -> Result<Note, AppError> {
    db.with(|conn| notes::save(conn, id, &body, color.as_deref()))
}

#[tauri::command]
pub async fn list_notes(
    db: State<'_, Db>,
    scope: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    let scope = Scope::parse(&scope)?;
    db.with(|conn| notes::list(conn, scope, limit, offset))
}

#[tauri::command]
pub async fn search_notes(
    db: State<'_, Db>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    db.with(|conn| notes::search(conn, &query, limit))
}

#[tauri::command]
pub async fn delete_note(db: State<'_, Db>, id: i64) -> Result<(), AppError> {
    db.with(|conn| notes::delete(conn, id))
}

#[tauri::command]
pub async fn restore_note(db: State<'_, Db>, id: i64) -> Result<Note, AppError> {
    db.with(|conn| notes::restore(conn, id))
}

#[tauri::command]
pub async fn purge_note(db: State<'_, Db>, id: i64) -> Result<(), AppError> {
    db.with(|conn| notes::purge(conn, id))
}
