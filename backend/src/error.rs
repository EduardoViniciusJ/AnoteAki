//! Erro único devolvido pelos comandos. O front recebe `{ code, message }` (PRD §12).
//! `message` é sempre um texto fixo de interface: nunca contém conteúdo de nota.

use serde::ser::{Serialize, SerializeStruct, Serializer};

/// Os demais códigos do contrato (`INVALID_INPUT`, `NOT_FOUND`, `DB_ERROR`,
/// `SHORTCUT_UNAVAILABLE`) entram junto com os comandos que os usam (T20+).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Internal(&'static str),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Internal(_) => "INTERNAL",
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(_: tauri::Error) -> Self {
        Self::Internal("Falha interna da janela.")
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
}
