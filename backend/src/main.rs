#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if anoteaki_lib::run().is_err() {
        // Startup errors never include note content.
        eprintln!("AnoteAki: não foi possível iniciar a janela.");
        std::process::exit(1);
    }
}
