//! Single error type returned by commands. The UI receives `{ code, message }` (PRD §12).
//! `message` is always fixed UI text: it never contains note content.

use serde::ser::{Serialize, SerializeStruct, Serializer};

/// `SHORTCUT_UNAVAILABLE` comes with `set_setting` (T50).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidInput(&'static str),
    #[error("Nota não encontrada.")]
    NotFound,
    #[error("{0}")]
    Db(&'static str),
    #[error("{0}")]
    Internal(&'static str),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::NotFound => "NOT_FOUND",
            Self::Db(_) => "DB_ERROR",
            Self::Internal(_) => "INTERNAL",
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(_: tauri::Error) -> Self {
        Self::Internal("Falha interna da janela.")
    }
}

/// SQLite errors are not sent to the UI: their message can quote parts of the query.
impl From<rusqlite::Error> for AppError {
    fn from(_: rusqlite::Error) -> Self {
        Self::Db("Falha no banco de dados.")
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_code_and_message() {
        let json = serde_json::to_string(&AppError::Internal("x")).unwrap();
        assert_eq!(json, r#"{"code":"INTERNAL","message":"x"}"#);
    }

    #[test]
    fn every_variant_has_a_contract_code() {
        assert_eq!(AppError::InvalidInput("x").code(), "INVALID_INPUT");
        assert_eq!(AppError::NotFound.code(), "NOT_FOUND");
        assert_eq!(AppError::Db("x").code(), "DB_ERROR");
    }

    #[test]
    fn sqlite_error_hides_details() {
        let error = AppError::from(rusqlite::Error::InvalidQuery);
        let json = serde_json::to_string(&error).unwrap();
        assert_eq!(
            json,
            r#"{"code":"DB_ERROR","message":"Falha no banco de dados."}"#
        );
    }
}
