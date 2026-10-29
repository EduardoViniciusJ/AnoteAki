//! Consultas de notas (PRD §12, "Comandos: notas"). Toda entrada é validada aqui,
//! e todo SQL é parametrizado.

use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::Serialize;

use crate::error::AppError;

/// Limite de `body`, em caracteres (PRD §12, decisão em aberto 4).
pub const BODY_MAX_CHARS: usize = 100_000;
pub const TITLE_MAX_CHARS: usize = 80;
pub const PREVIEW_MAX_CHARS: usize = 140;
pub const QUERY_MAX_CHARS: usize = 200;
pub const LIMIT_DEFAULT: i64 = 50;
pub const LIMIT_MAX: i64 = 200;
pub const STICKER_COLORS: [&str; 6] = ["yellow", "pink", "blue", "green", "lilac", "paper"];

/// ISO 8601 em UTC com milissegundos, gerado pelo próprio SQLite (PRD §12).
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/// Só o começo do corpo é lido para montar o preview da lista.
const PREVIEW_SOURCE_CHARS: usize = 2_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteSummary {
    pub id: i64,
    pub title: String,
    pub preview: String,
    pub color: Option<String>,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Scope {
    Active,
    Trash,
}

impl Scope {
    pub fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "active" => Ok(Self::Active),
            "trash" => Ok(Self::Trash),
            _ => Err(AppError::InvalidInput("Escopo inválido.")),
        }
    }
}

const NOTE_COLUMNS: &str = "id, title, body, color, created_at, updated_at, deleted_at";

fn note_from_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        body: row.get(2)?,
        color: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        deleted_at: row.get(6)?,
    })
}

/// Colunas para `summary_from_row`, com o corpo truncado em SQL (a nota pode ter 100 mil chars).
fn summary_columns(table: &str) -> String {
    format!(
        "{table}.id, {table}.title, substr({table}.body, 1, {PREVIEW_SOURCE_CHARS}), \
         {table}.color, {table}.updated_at, {table}.deleted_at"
    )
}

fn summary_from_row(row: &Row<'_>) -> rusqlite::Result<NoteSummary> {
    let body: String = row.get(2)?;
    Ok(NoteSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        preview: derive_preview(&body),
        color: row.get(3)?,
        updated_at: row.get(4)?,
        deleted_at: row.get(5)?,
    })
}

fn truncate_chars(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

/// 1ª linha não vazia, sem espaços nas pontas, até 80 caracteres; `""` se o corpo estiver vazio.
pub fn derive_title(body: &str) -> String {
    body.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| truncate_chars(line, TITLE_MAX_CHARS))
        .unwrap_or_default()
}

/// O corpo depois da linha do título, com os espaços colapsados, até 140 caracteres.
pub fn derive_preview(body: &str) -> String {
    let mut lines = body.lines().skip_while(|line| line.trim().is_empty());
    lines.next();
    let rest: Vec<&str> = lines.flat_map(str::split_whitespace).collect();
    truncate_chars(&rest.join(" "), PREVIEW_MAX_CHARS)
}

fn validate_body(body: &str) -> Result<(), AppError> {
    if body.chars().count() > BODY_MAX_CHARS {
        return Err(AppError::InvalidInput(
            "A nota passou do limite de 100 000 caracteres.",
        ));
    }
    Ok(())
}

fn validate_color(color: Option<&str>) -> Result<(), AppError> {
    match color {
        Some(value) if !STICKER_COLORS.contains(&value) => {
            Err(AppError::InvalidInput("Cor inválida."))
        }
        _ => Ok(()),
    }
}

fn validate_limit(limit: Option<i64>) -> Result<i64, AppError> {
    let limit = limit.unwrap_or(LIMIT_DEFAULT);
    if !(1..=LIMIT_MAX).contains(&limit) {
        return Err(AppError::InvalidInput("Limite inválido."));
    }
    Ok(limit)
}

/// Transforma o texto digitado numa consulta FTS5 literal: cada termo vira uma frase entre
/// aspas (aspas internas dobradas) e o último ganha `*` (busca por prefixo enquanto digita).
/// Assim `"`, `*`, `-`, `NEAR`, `AND`… nunca viram sintaxe. `None` se não sobrar termo.
pub fn escape_fts_query(query: &str) -> Option<String> {
    // Um termo só de pontuação não gera token no unicode61: fica de fora.
    let terms: Vec<String> = query
        .split_whitespace()
        .filter(|term| term.chars().any(char::is_alphanumeric))
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect();
    if terms.is_empty() {
        return None;
    }
    Some(format!("{}*", terms.join(" ")))
}

pub fn get(conn: &Connection, id: i64) -> Result<Note, AppError> {
    conn.query_row(
        &format!("SELECT {NOTE_COLUMNS} FROM notes WHERE id = ?1"),
        [id],
        note_from_row,
    )
    .optional()?
    .ok_or(AppError::NotFound)
}

/// A nota ativa com maior `updatedAt`.
pub fn get_last(conn: &Connection) -> Result<Option<Note>, AppError> {
    Ok(conn
        .query_row(
            &format!(
                "SELECT {NOTE_COLUMNS} FROM notes WHERE deleted_at IS NULL \
                 ORDER BY updated_at DESC, id DESC LIMIT 1"
            ),
            [],
            note_from_row,
        )
        .optional()?)
}

/// Cria (`id = None`) ou atualiza. `color = None` mantém a cor atual na atualização
/// (o `invoke` não distingue o campo ausente de `null`).
pub fn save(
    conn: &Connection,
    id: Option<i64>,
    body: &str,
    color: Option<&str>,
) -> Result<Note, AppError> {
    validate_body(body)?;
    validate_color(color)?;
    let title = derive_title(body);

    let Some(id) = id else {
        conn.execute(
            &format!(
                "INSERT INTO notes (title, body, color, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, {NOW}, {NOW})"
            ),
            params![title, body, color],
        )?;
        return get(conn, conn.last_insert_rowid());
    };

    let current = get(conn, id)?;
    if current.deleted_at.is_some() {
        return Err(AppError::InvalidInput("Restaure a nota antes de editá-la."));
    }
    let color = color.map(str::to_owned).or(current.color.clone());
    // Sem mudança: não mexe no updatedAt (senão um flush sem edição reordenaria o histórico).
    if current.body == body && current.color == color {
        return Ok(current);
    }
    conn.execute(
        &format!(
            "UPDATE notes SET title = ?1, body = ?2, color = ?3, updated_at = {NOW} WHERE id = ?4"
        ),
        params![title, body, color, id],
    )?;
    get(conn, id)
}

/// `active` exclui as notas vazias (título vazio = corpo vazio ou só espaços).
pub fn list(
    conn: &Connection,
    scope: Scope,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    let limit = validate_limit(limit)?;
    let offset = offset.unwrap_or(0);
    if offset < 0 {
        return Err(AppError::InvalidInput("Offset inválido."));
    }
    let filter = match scope {
        Scope::Active => "deleted_at IS NULL AND title <> ''",
        Scope::Trash => "deleted_at IS NOT NULL",
    };
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM notes WHERE {filter} \
         ORDER BY updated_at DESC, id DESC LIMIT ?1 OFFSET ?2",
        summary_columns("notes")
    ))?;
    let rows = stmt.query_map(params![limit, offset], summary_from_row)?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// FTS5 em title+body, só notas ativas, por relevância (`bm25`).
pub fn search(
    conn: &Connection,
    query: &str,
    limit: Option<i64>,
) -> Result<Vec<NoteSummary>, AppError> {
    let query = query.trim();
    let length = query.chars().count();
    if length == 0 || length > QUERY_MAX_CHARS {
        return Err(AppError::InvalidInput(
            "A busca precisa ter de 1 a 200 caracteres.",
        ));
    }
    let limit = validate_limit(limit)?;
    let Some(fts_query) = escape_fts_query(query) else {
        return Ok(Vec::new());
    };
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM notes_fts JOIN notes ON notes.id = notes_fts.rowid \
         WHERE notes_fts MATCH ?1 AND notes.deleted_at IS NULL AND notes.title <> '' \
         ORDER BY bm25(notes_fts), notes.updated_at DESC LIMIT ?2",
        summary_columns("notes")
    ))?;
    let rows = stmt.query_map(params![fts_query, limit], summary_from_row)?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Soft delete. Excluir uma nota que já está na lixeira não muda nada.
pub fn delete(conn: &Connection, id: i64) -> Result<(), AppError> {
    get(conn, id)?;
    conn.execute(
        &format!("UPDATE notes SET deleted_at = {NOW} WHERE id = ?1 AND deleted_at IS NULL"),
        [id],
    )?;
    Ok(())
}

pub fn restore(conn: &Connection, id: i64) -> Result<Note, AppError> {
    get(conn, id)?;
    conn.execute("UPDATE notes SET deleted_at = NULL WHERE id = ?1", [id])?;
    get(conn, id)
}

/// Remoção definitiva, só para notas na lixeira.
pub fn purge(conn: &Connection, id: i64) -> Result<(), AppError> {
    if get(conn, id)?.deleted_at.is_none() {
        return Err(AppError::InvalidInput(
            "Só notas na lixeira podem ser excluídas para sempre.",
        ));
    }
    conn.execute("DELETE FROM notes WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn create(conn: &Connection, body: &str) -> Note {
        save(conn, None, body, None).unwrap()
    }

    /// Força o `updated_at` para testar a ordem sem depender do relógio.
    fn set_updated(conn: &Connection, id: i64, at: &str) {
        conn.execute(
            "UPDATE notes SET updated_at = ?1 WHERE id = ?2",
            params![at, id],
        )
        .unwrap();
    }

    fn ids(list: &[NoteSummary]) -> Vec<i64> {
        list.iter().map(|n| n.id).collect()
    }

    fn fts_count(conn: &Connection, query: &str) -> i64 {
        conn.query_row(
            "SELECT count(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            [query],
            |r| r.get(0),
        )
        .unwrap()
    }

    // --- título e preview

    #[test]
    fn title_is_the_first_non_empty_line_trimmed() {
        assert_eq!(derive_title("\n  \n  Compras  \nleite"), "Compras");
        assert_eq!(derive_title(""), "");
        assert_eq!(derive_title("  \n\t\n"), "");
        assert_eq!(derive_title("linha\r\noutra"), "linha");
    }

    #[test]
    fn title_is_cut_at_80_characters_not_bytes() {
        let long = "á".repeat(100);
        assert_eq!(derive_title(&long).chars().count(), 80);
    }

    #[test]
    fn preview_skips_the_title_line_and_collapses_spaces() {
        assert_eq!(
            derive_preview("\nTítulo\n  leite   \n\n pão\tovos"),
            "leite pão ovos"
        );
        assert_eq!(derive_preview("só título"), "");
        assert_eq!(
            derive_preview(&format!("t\n{}", "x".repeat(300))).len(),
            140
        );
    }

    // --- save / get

    #[test]
    fn creates_a_note_with_derived_title_and_utc_timestamps() {
        let conn = open_in_memory();
        let note = create(&conn, "Compras\nleite");
        assert_eq!(note.title, "Compras");
        assert_eq!(note.body, "Compras\nleite");
        assert_eq!(note.color, None);
        assert_eq!(note.deleted_at, None);
        assert_eq!(note.created_at, note.updated_at);
        // 2026-10-28T14:03:12.123Z
        assert_eq!(note.created_at.len(), 24);
        assert!(note.created_at.ends_with('Z'));
        assert_eq!(get(&conn, note.id).unwrap(), note);
    }

    #[test]
    fn updates_body_title_and_updated_at() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        set_updated(&conn, note.id, "2000-01-01T00:00:00.000Z");
        let saved = save(&conn, Some(note.id), "novo título\ncorpo", None).unwrap();
        assert_eq!(saved.id, note.id);
        assert_eq!(saved.title, "novo título");
        assert_ne!(saved.updated_at, "2000-01-01T00:00:00.000Z");
        assert_eq!(saved.created_at, note.created_at);
    }

    #[test]
    fn saving_the_same_text_keeps_updated_at() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        set_updated(&conn, note.id, "2000-01-01T00:00:00.000Z");
        let saved = save(&conn, Some(note.id), "a", None).unwrap();
        assert_eq!(saved.updated_at, "2000-01-01T00:00:00.000Z");
    }

    #[test]
    fn color_is_validated_and_kept_when_omitted() {
        let conn = open_in_memory();
        let note = save(&conn, None, "a", Some("pink")).unwrap();
        assert_eq!(note.color.as_deref(), Some("pink"));
        let saved = save(&conn, Some(note.id), "b", None).unwrap();
        assert_eq!(saved.color.as_deref(), Some("pink"));
        let error = save(&conn, Some(note.id), "b", Some("red")).unwrap_err();
        assert_eq!(error.code(), "INVALID_INPUT");
    }

    #[test]
    fn body_limit_is_100_000_characters() {
        let conn = open_in_memory();
        // 100 000 caracteres de 2 bytes cada: o limite é em caracteres.
        assert!(save(&conn, None, &"ç".repeat(BODY_MAX_CHARS), None).is_ok());
        let error = save(&conn, None, &"a".repeat(BODY_MAX_CHARS + 1), None).unwrap_err();
        assert_eq!(error.code(), "INVALID_INPUT");
    }

    #[test]
    fn unknown_id_is_not_found() {
        let conn = open_in_memory();
        assert_eq!(get(&conn, 42).unwrap_err().code(), "NOT_FOUND");
        assert_eq!(
            save(&conn, Some(42), "a", None).unwrap_err().code(),
            "NOT_FOUND"
        );
        assert_eq!(delete(&conn, 42).unwrap_err().code(), "NOT_FOUND");
        assert_eq!(restore(&conn, 42).unwrap_err().code(), "NOT_FOUND");
        assert_eq!(purge(&conn, 42).unwrap_err().code(), "NOT_FOUND");
    }

    #[test]
    fn a_note_in_the_trash_cannot_be_saved() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        delete(&conn, note.id).unwrap();
        let error = save(&conn, Some(note.id), "b", None).unwrap_err();
        assert_eq!(error.code(), "INVALID_INPUT");
        assert_eq!(get(&conn, note.id).unwrap().body, "a");
    }

    #[test]
    fn get_includes_notes_in_the_trash() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        delete(&conn, note.id).unwrap();
        assert!(get(&conn, note.id).unwrap().deleted_at.is_some());
    }

    #[test]
    fn last_note_is_the_most_recent_active_one() {
        let conn = open_in_memory();
        assert_eq!(get_last(&conn).unwrap(), None);
        let old = create(&conn, "velha");
        let new = create(&conn, "nova");
        set_updated(&conn, old.id, "2026-01-02T00:00:00.000Z");
        set_updated(&conn, new.id, "2026-01-01T00:00:00.000Z");
        assert_eq!(get_last(&conn).unwrap().unwrap().id, old.id);
        delete(&conn, old.id).unwrap();
        assert_eq!(get_last(&conn).unwrap().unwrap().id, new.id);
    }

    // --- list

    #[test]
    fn list_orders_by_updated_at_and_hides_empty_notes() {
        let conn = open_in_memory();
        let a = create(&conn, "a");
        let b = create(&conn, "b");
        let empty = create(&conn, "  \n ");
        set_updated(&conn, a.id, "2026-01-03T00:00:00.000Z");
        set_updated(&conn, b.id, "2026-01-04T00:00:00.000Z");
        set_updated(&conn, empty.id, "2026-01-05T00:00:00.000Z");
        let list = list(&conn, Scope::Active, None, None).unwrap();
        assert_eq!(ids(&list), vec![b.id, a.id]);
    }

    #[test]
    fn list_separates_active_and_trash() {
        let conn = open_in_memory();
        let a = create(&conn, "a");
        let b = create(&conn, "b");
        delete(&conn, a.id).unwrap();
        assert_eq!(
            ids(&list(&conn, Scope::Active, None, None).unwrap()),
            vec![b.id]
        );
        let trash = list(&conn, Scope::Trash, None, None).unwrap();
        assert_eq!(ids(&trash), vec![a.id]);
        assert!(trash[0].deleted_at.is_some());
    }

    #[test]
    fn list_paginates() {
        let conn = open_in_memory();
        for i in 0..5 {
            let note = create(&conn, &format!("n{i}"));
            set_updated(&conn, note.id, &format!("2026-01-0{}T00:00:00.000Z", i + 1));
        }
        let first = list(&conn, Scope::Active, Some(2), Some(0)).unwrap();
        let second = list(&conn, Scope::Active, Some(2), Some(2)).unwrap();
        let last = list(&conn, Scope::Active, Some(2), Some(4)).unwrap();
        assert_eq!(ids(&first), vec![5, 4]);
        assert_eq!(ids(&second), vec![3, 2]);
        assert_eq!(ids(&last), vec![1]);
    }

    #[test]
    fn list_validates_limit_and_offset() {
        let conn = open_in_memory();
        for (limit, offset) in [(Some(0), None), (Some(201), None), (None, Some(-1))] {
            let error = list(&conn, Scope::Active, limit, offset).unwrap_err();
            assert_eq!(error.code(), "INVALID_INPUT");
        }
        assert!(list(&conn, Scope::Active, Some(200), Some(0)).is_ok());
        assert_eq!(Scope::parse("x").unwrap_err().code(), "INVALID_INPUT");
    }

    #[test]
    fn list_preview_comes_from_the_body() {
        let conn = open_in_memory();
        create(&conn, "Título\nprimeira   linha\nsegunda");
        let list = list(&conn, Scope::Active, None, None).unwrap();
        assert_eq!(list[0].preview, "primeira linha segunda");
    }

    // --- busca

    #[test]
    fn fts5_is_available_in_the_bundled_sqlite() {
        let conn = open_in_memory();
        let options: i64 = conn
            .query_row("SELECT sqlite_compileoption_used('ENABLE_FTS5')", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(options, 1);
    }

    #[test]
    fn search_ignores_accents_and_case() {
        let conn = open_in_memory();
        let note = create(&conn, "Plano de AÇÃO\nrevisar");
        create(&conn, "outra coisa");
        assert_eq!(ids(&search(&conn, "acao", None).unwrap()), vec![note.id]);
        assert_eq!(ids(&search(&conn, "AÇÃO", None).unwrap()), vec![note.id]);
        assert_eq!(ids(&search(&conn, "revis", None).unwrap()), vec![note.id]);
    }

    #[test]
    fn search_matches_all_terms() {
        let conn = open_in_memory();
        let both = create(&conn, "leite e pão");
        create(&conn, "só leite");
        assert_eq!(
            ids(&search(&conn, "pão leite", None).unwrap()),
            vec![both.id]
        );
    }

    #[test]
    fn search_treats_fts_syntax_as_text() {
        let conn = open_in_memory();
        let note = create(&conn, "near the \"end\" - a*b");
        for query in [
            "\"",
            "\"end",
            "*",
            "-",
            "a*b",
            "- end",
            "NEAR",
            "near(end)",
            "AND",
            "OR end",
            "NOT",
            "title:end",
            "^end",
            "(end",
            "end)",
            "{title}: end",
        ] {
            let result = search(&conn, query, None);
            assert!(result.is_ok(), "a busca {query:?} falhou: {result:?}");
        }
        assert_eq!(ids(&search(&conn, "NEAR", None).unwrap()), vec![note.id]);
        assert_eq!(ids(&search(&conn, "\"end\"", None).unwrap()), vec![note.id]);
    }

    #[test]
    fn search_only_returns_active_non_empty_notes() {
        let conn = open_in_memory();
        let active = create(&conn, "relatório 1");
        let trashed = create(&conn, "relatório 2");
        delete(&conn, trashed.id).unwrap();
        assert_eq!(
            ids(&search(&conn, "relatorio", None).unwrap()),
            vec![active.id]
        );
    }

    #[test]
    fn search_orders_by_relevance() {
        let conn = open_in_memory();
        let weak = create(
            &conn,
            "uma nota longa sobre muitas coisas e também gato no fim",
        );
        let strong = create(&conn, "gato gato gato");
        assert_eq!(
            ids(&search(&conn, "gato", None).unwrap()),
            vec![strong.id, weak.id]
        );
    }

    #[test]
    fn search_validates_the_query() {
        let conn = open_in_memory();
        for query in ["", "   ", &"a".repeat(QUERY_MAX_CHARS + 1)] {
            assert_eq!(
                search(&conn, query, None).unwrap_err().code(),
                "INVALID_INPUT"
            );
        }
        assert!(search(&conn, &"a".repeat(QUERY_MAX_CHARS), None).is_ok());
        assert_eq!(
            search(&conn, "a", Some(0)).unwrap_err().code(),
            "INVALID_INPUT"
        );
    }

    #[test]
    fn escape_fts_query_quotes_every_term() {
        assert_eq!(
            escape_fts_query("plano ação").as_deref(),
            Some("\"plano\" \"ação\"*")
        );
        assert_eq!(
            escape_fts_query("a\"b NEAR").as_deref(),
            Some("\"a\"\"b\" \"NEAR\"*")
        );
        assert_eq!(escape_fts_query(" - * \" "), None);
    }

    // --- FTS em sincronia (triggers)

    #[test]
    fn fts_follows_insert_update_and_delete() {
        let conn = open_in_memory();
        let note = create(&conn, "abacaxi");
        assert_eq!(fts_count(&conn, "abacaxi"), 1);
        save(&conn, Some(note.id), "banana", None).unwrap();
        assert_eq!(fts_count(&conn, "abacaxi"), 0);
        assert_eq!(fts_count(&conn, "banana"), 1);
        delete(&conn, note.id).unwrap();
        restore(&conn, note.id).unwrap();
        assert_eq!(fts_count(&conn, "banana"), 1);
        delete(&conn, note.id).unwrap();
        purge(&conn, note.id).unwrap();
        assert_eq!(fts_count(&conn, "banana"), 0);
    }

    // --- lixeira

    #[test]
    fn delete_then_restore_returns_to_active() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        delete(&conn, note.id).unwrap();
        // Excluir de novo não muda o deletedAt nem falha.
        let deleted_at = get(&conn, note.id).unwrap().deleted_at;
        delete(&conn, note.id).unwrap();
        assert_eq!(get(&conn, note.id).unwrap().deleted_at, deleted_at);
        let restored = restore(&conn, note.id).unwrap();
        assert_eq!(restored.deleted_at, None);
        assert_eq!(
            ids(&list(&conn, Scope::Active, None, None).unwrap()),
            vec![note.id]
        );
    }

    #[test]
    fn purge_only_works_in_the_trash() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        assert_eq!(purge(&conn, note.id).unwrap_err().code(), "INVALID_INPUT");
        delete(&conn, note.id).unwrap();
        purge(&conn, note.id).unwrap();
        assert_eq!(get(&conn, note.id).unwrap_err().code(), "NOT_FOUND");
    }

    #[test]
    fn serializes_in_camel_case() {
        let conn = open_in_memory();
        let note = create(&conn, "a");
        let json = serde_json::to_value(&note).unwrap();
        for key in [
            "createdAt",
            "updatedAt",
            "deletedAt",
            "color",
            "title",
            "body",
        ] {
            assert!(json.get(key).is_some(), "faltou {key}");
        }
        let summary = &list(&conn, Scope::Active, None, None).unwrap()[0];
        let json = serde_json::to_value(summary).unwrap();
        assert!(json.get("preview").is_some());
        assert!(json.get("updatedAt").is_some());
    }
}
