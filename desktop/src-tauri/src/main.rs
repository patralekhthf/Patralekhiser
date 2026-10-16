// Svara desktop shell.
//
// Deliberately empty of logic. The entire application is the single HTML file
// in ../dist, which also runs in a plain browser. Keeping the Rust side at
// zero commands means the desktop build and the browser build cannot drift,
// and there is no native surface to audit.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Svara");
}
