#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if anoteaki_lib::run().is_err() {
        // Falhas de inicialização nunca incluem conteúdo de notas.
        eprintln!("AnoteAki: não foi possível iniciar a janela.");
        std::process::exit(1);
    }
}
