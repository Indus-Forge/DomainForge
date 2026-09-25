//! The desktop shell for Workshop.
//!
//! The app itself is the same web app that runs in the browser. This shell adds
//! what a web page can't do on its own:
//! - talk to AI running on this computer (the http plugin, limited to local addresses),
//! - save boards and summaries as real files where the person chooses (dialog + fs plugins),
//! - measure the computer, so the Model Library can recommend tools that fit.

use serde::Serialize;
use std::path::PathBuf;
use sysinfo::{Disks, System};

#[derive(Serialize)]
struct ComputerInfo {
    memory_gb: f64,
    /// Free space on the drive where AI tools are kept, if it can be found.
    free_disk_gb: Option<f64>,
    cores: usize,
}

/// Where the private AI runtime (Ollama) keeps its tools.
fn models_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("OLLAMA_MODELS") {
        return Some(PathBuf::from(dir));
    }
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(|home| PathBuf::from(home).join(".ollama"))
}

#[tauri::command]
fn computer_info() -> ComputerInfo {
    let mut system = System::new();
    system.refresh_memory();
    let gb = |bytes: u64| bytes as f64 / 1_000_000_000.0;

    let disks = Disks::new_with_refreshed_list();
    let free_disk_gb = models_dir().and_then(|dir| {
        disks
            .list()
            .iter()
            .filter(|d| dir.starts_with(d.mount_point()))
            .max_by_key(|d| d.mount_point().as_os_str().len())
            .map(|d| gb(d.available_space()))
    });

    ComputerInfo {
        memory_gb: gb(system.total_memory()),
        free_disk_gb,
        cores: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![computer_info])
        .run(tauri::generate_context!())
        .expect("Workshop could not start");
}
