fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Comandos do app entram no ACL: cada um ganha uma permissão `allow-<comando>`.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "hide_window",
            "get_shortcut_status",
            "get_last_note",
            "get_note",
            "save_note",
            "list_notes",
            "search_notes",
            "delete_note",
            "restore_note",
            "purge_note",
        ]),
    ))?;
    Ok(())
}
