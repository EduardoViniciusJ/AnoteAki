//! Banco SQLite: abertura, migrações e consultas.
//!
//! Uma conexão só, atrás de um `Mutex` (PRD §6): o volume é baixo e o acesso serializado
//! evita `SQLITE_BUSY` entre comandos.

pub mod notes;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppError;

/// Nome do arquivo dentro de `app_data_dir` (`%APPDATA%\com.anoteaki.desktop`).
pub const FILE_NAME: &str = "anoteaki.db";

/// Migrações em ordem; o índice + 1 é o `PRAGMA user_version` depois de aplicá-la.
const MIGRATIONS: &[&str] = &[include_str!("migrations/001_init.sql")];

/// `PRAGMA user_version` depois de todas as migrações.
fn latest_version() -> i64 {
    MIGRATIONS.len() as i64
}

/// Estado gerenciado pelo Tauri. `None` = o banco não abriu; os comandos devolvem `DB_ERROR`
/// em vez de o app fechar em silêncio (PRD §8).
pub struct Db(Mutex<Option<Connection>>);

impl Db {
    pub fn new(conn: Option<Connection>) -> Self {
        Self(Mutex::new(conn))
    }

    /// Executa `f` com a conexão.
    pub fn with<T>(
        &self,
        f: impl FnOnce(&mut Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::Internal("Falha interna do banco."))?;
        let conn = guard
            .as_mut()
            .ok_or(AppError::Db("O banco de dados não pôde ser aberto."))?;
        f(conn)
    }
}

/// Abre (ou cria) o banco em `path` e aplica as migrações pendentes.
pub fn open(path: &Path) -> Result<Connection, AppError> {
    let mut conn = Connection::open(path)?;
    // WAL: escrita sem bloquear leitura e mais resistente a encerramento forçado.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(std::time::Duration::from_secs(2))?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Banco em memória já migrado, para os testes.
#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    conn
}

/// Aplica, cada uma numa transação, as migrações acima do `user_version` atual.
pub fn migrate(conn: &mut Connection) -> Result<(), AppError> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if current > latest_version() {
        // Banco criado por uma versão mais nova do app: não mexer.
        return Err(AppError::Db(
            "O banco de dados é de uma versão mais nova do AnoteAki.",
        ));
    }
    for (version, sql) in (1..).zip(MIGRATIONS) {
        if version <= current {
            continue;
        }
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user_version(conn: &Connection) -> i64 {
        conn.pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap()
    }

    fn exists(conn: &Connection, name: &str) -> bool {
        conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE name = ?1",
            [name],
            |row| row.get::<_, i64>(0),
        )
        .unwrap()
            == 1
    }

    #[test]
    fn migrates_a_new_database_to_the_latest_version() {
        let conn = open_in_memory();
        assert_eq!(user_version(&conn), latest_version());
        for name in ["notes", "notes_fts", "settings", "idx_notes_updated"] {
            assert!(exists(&conn, name), "faltou {name}");
        }
    }

    #[test]
    fn migrating_twice_is_a_no_op() {
        let mut conn = open_in_memory();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('theme', 'dark')",
            [],
        )
        .unwrap();
        migrate(&mut conn).unwrap();
        let theme: String = conn
            .query_row("SELECT value FROM settings WHERE key = 'theme'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(theme, "dark");
    }

    #[test]
    fn refuses_a_database_from_a_newer_app() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "user_version", latest_version() + 1)
            .unwrap();
        let error = migrate(&mut conn).unwrap_err();
        assert_eq!(error.code(), "DB_ERROR");
    }

    #[test]
    fn opens_a_file_in_wal_mode_and_reopens_it() {
        let dir = std::env::temp_dir().join(format!("anoteaki-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(FILE_NAME);
        {
            let conn = open(&path).unwrap();
            let mode: String = conn
                .pragma_query_value(None, "journal_mode", |r| r.get(0))
                .unwrap();
            assert_eq!(mode, "wal");
        }
        let conn = open(&path).unwrap();
        assert_eq!(user_version(&conn), latest_version());
        drop(conn);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn unavailable_database_returns_db_error() {
        let db = Db::new(None);
        let error = db.with(|_| Ok(())).unwrap_err();
        assert_eq!(error.code(), "DB_ERROR");
    }
}
