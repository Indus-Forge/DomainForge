//! The desktop shell for Workshop.
//!
//! The app itself is the same web app that runs in the browser. This shell adds
//! what a web page can't do on its own:
//! - talk to AI running on this computer (the http plugin, limited to local addresses),
//! - save boards as real files where the person chooses (dialog + fs plugins).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("Workshop could not start");
}
