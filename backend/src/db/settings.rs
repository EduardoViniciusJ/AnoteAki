//! App settings (PRD §12): key/value rows in the `settings` table.
//! Missing or invalid rows fall back to the contract defaults.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+K";
/// An accelerator is short ("Ctrl+Shift+Alt+F12"); anything longer is not one.
pub const SHORTCUT_MAX_CHARS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

impl Theme {
    pub fn parse(value: &str) -> Result<Self, AppError> {
        match value {
            "system" => Ok(Self::System),
            "light" => Ok(Self::Light),
            "dark" => Ok(Self::Dark),
            _ => Err(AppError::InvalidInput("Tema inválido.")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Light => "light",
            Self::Dark => "dark",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    pub shortcut: String,
    pub hide_on_blur: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            shortcut: DEFAULT_SHORTCUT.to_owned(),
            hide_on_blur: true,
        }
    }
}

/// `value` of `set_setting`: the UI sends a string or a boolean.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(untagged)]
pub enum SettingValue {
    Bool(bool),
    Text(String),
}

/// One validated change. The shortcut is only checked for format here;
/// whether Windows accepts it is checked when registering it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Change {
    Theme(Theme),
    Shortcut(String),
    HideOnBlur(bool),
}

impl Change {
    pub fn parse(key: &str, value: SettingValue) -> Result<Self, AppError> {
        match (key, value) {
            ("theme", SettingValue::Text(text)) => Ok(Self::Theme(Theme::parse(&text)?)),
            ("shortcut", SettingValue::Text(text)) => {
                let text = text.trim();
                if text.is_empty() || text.chars().count() > SHORTCUT_MAX_CHARS {
                    return Err(AppError::InvalidInput("Atalho inválido."));
                }
                Ok(Self::Shortcut(text.to_owned()))
            }
            ("hideOnBlur", SettingValue::Bool(on)) => Ok(Self::HideOnBlur(on)),
            ("theme" | "shortcut" | "hideOnBlur", _) => {
                Err(AppError::InvalidInput("Tipo de valor inválido."))
            }
            _ => Err(AppError::InvalidInput("Configuração desconhecida.")),
        }
    }
}

/// Reads all settings. A row with an unknown value is ignored (default wins).
pub fn load(conn: &Connection) -> Result<Settings, AppError> {
    let mut settings = Settings::default();
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    for row in rows {
        let (key, value) = row?;
        match key.as_str() {
            "theme" => {
                if let Ok(theme) = Theme::parse(&value) {
                    settings.theme = theme;
                }
            }
            "shortcut" if !value.is_empty() => settings.shortcut = value,
            "hideOnBlur" => match value.as_str() {
                "true" => settings.hide_on_blur = true,
                "false" => settings.hide_on_blur = false,
                _ => {}
            },
            _ => {}
        }
    }
    Ok(settings)
}

pub fn store(conn: &Connection, change: &Change) -> Result<(), AppError> {
    let (key, value) = match change {
        Change::Theme(theme) => ("theme", theme.as_str().to_owned()),
        Change::Shortcut(shortcut) => ("shortcut", shortcut.clone()),
        Change::HideOnBlur(on) => ("hideOnBlur", on.to_string()),
    };
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn text(value: &str) -> SettingValue {
        SettingValue::Text(value.to_owned())
    }

    #[test]
    fn empty_database_returns_defaults() {
        let conn = open_in_memory();
        assert_eq!(load(&conn).unwrap(), Settings::default());
    }

    #[test]
    fn stored_values_are_read_back() {
        let conn = open_in_memory();
        store(&conn, &Change::Theme(Theme::Dark)).unwrap();
        store(&conn, &Change::Shortcut("Ctrl+Shift+N".to_owned())).unwrap();
        store(&conn, &Change::HideOnBlur(false)).unwrap();
        store(&conn, &Change::Theme(Theme::Light)).unwrap();
        let settings = load(&conn).unwrap();
        assert_eq!(settings.theme, Theme::Light);
        assert_eq!(settings.shortcut, "Ctrl+Shift+N");
        assert!(!settings.hide_on_blur);
    }

    #[test]
    fn invalid_rows_fall_back_to_defaults() {
        let conn = open_in_memory();
        conn.execute_batch(
            "INSERT INTO settings (key, value) VALUES ('theme', 'neon'), \
             ('hideOnBlur', 'maybe'), ('shortcut', ''), ('autostart', 'true')",
        )
        .unwrap();
        assert_eq!(load(&conn).unwrap(), Settings::default());
    }

    #[test]
    fn parses_each_key_with_its_type() {
        assert_eq!(
            Change::parse("theme", text("dark")).unwrap(),
            Change::Theme(Theme::Dark)
        );
        assert_eq!(
            Change::parse("shortcut", text("  Ctrl+Alt+J ")).unwrap(),
            Change::Shortcut("Ctrl+Alt+J".to_owned())
        );
        assert_eq!(
            Change::parse("hideOnBlur", SettingValue::Bool(false)).unwrap(),
            Change::HideOnBlur(false)
        );
    }

    #[test]
    fn rejects_wrong_keys_types_and_values() {
        let cases = [
            Change::parse("theme", SettingValue::Bool(true)),
            Change::parse("theme", text("neon")),
            Change::parse("hideOnBlur", text("true")),
            Change::parse("shortcut", SettingValue::Bool(true)),
            Change::parse("shortcut", text("   ")),
            Change::parse("shortcut", text(&"K".repeat(SHORTCUT_MAX_CHARS + 1))),
            Change::parse("autostart", SettingValue::Bool(true)),
        ];
        for case in cases {
            assert_eq!(case.unwrap_err().code(), "INVALID_INPUT");
        }
    }

    #[test]
    fn value_accepts_string_or_boolean_json() {
        let value: SettingValue = serde_json::from_str("true").unwrap();
        assert_eq!(value, SettingValue::Bool(true));
        let value: SettingValue = serde_json::from_str(r#""dark""#).unwrap();
        assert_eq!(value, text("dark"));
        assert!(serde_json::from_str::<SettingValue>("1").is_err());
    }

    #[test]
    fn settings_match_contract() {
        let json = serde_json::to_string(&Settings::default()).unwrap();
        assert_eq!(
            json,
            r#"{"theme":"system","shortcut":"Ctrl+Alt+K","hideOnBlur":true}"#
        );
    }
}
