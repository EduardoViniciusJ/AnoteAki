//! Links clicked in a note (Ctrl+click), opened in the default browser.
//! The URL may contain note text: it is never logged.

use tauri::{AppHandle, Url};
use tauri_plugin_opener::OpenerExt;

use crate::error::AppError;

/// Longest URL accepted (PRD §12).
pub const MAX_URL_CHARS: usize = 2048;

/// Accepts only `http`/`https` URLs with a host, up to `MAX_URL_CHARS` characters.
pub fn validate(text: &str) -> Result<Url, AppError> {
    const INVALID: AppError = AppError::InvalidInput("Link inválido.");
    if text.chars().count() > MAX_URL_CHARS {
        return Err(INVALID);
    }
    let url = Url::parse(text).map_err(|_| INVALID)?;
    let web = matches!(url.scheme(), "http" | "https");
    if !web || url.host_str().is_none_or(str::is_empty) {
        return Err(INVALID);
    }
    Ok(url)
}

/// Validates the URL and opens it in the default browser.
pub fn open(app: &AppHandle, text: &str) -> Result<(), AppError> {
    let url = validate(text)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| AppError::Internal("Não foi possível abrir o link."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_http_and_https() {
        for url in [
            "http://example.com",
            "https://example.com/path?q=1#top",
            "HTTPS://Example.com",
            "https://192.168.0.1:8080/",
        ] {
            assert!(validate(url).is_ok(), "{url}");
        }
    }

    #[test]
    fn rejects_other_schemes_and_plain_text() {
        for url in [
            "file:///C:/Windows/System32/cmd.exe",
            "javascript:alert(1)",
            "data:text/html,<b>x</b>",
            "ftp://example.com",
            "mailto:a@b.com",
            "ms-settings:privacy",
            "example.com",
            "just some words",
            "",
            "https://",
        ] {
            let error = validate(url).unwrap_err();
            assert_eq!(error.code(), "INVALID_INPUT", "{url}");
        }
    }

    #[test]
    fn length_limit_is_2048_characters() {
        let base = "https://example.com/";
        let fits = format!("{base}{}", "a".repeat(MAX_URL_CHARS - base.len()));
        assert!(validate(&fits).is_ok());
        let long = format!("{fits}a");
        assert_eq!(validate(&long).unwrap_err().code(), "INVALID_INPUT");
    }

    #[test]
    fn error_message_does_not_echo_the_url() {
        let error = validate("javascript:secret-note-text").unwrap_err();
        assert!(!error.to_string().contains("secret"));
    }
}
