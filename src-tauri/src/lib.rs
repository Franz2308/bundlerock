pub mod commands;
pub mod engine;
pub mod manager;
pub mod media_extractor;
pub mod models;
pub mod probe;
pub mod storage;

use commands::*;
use manager::DownloadManager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DownloadManager::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            probe_url,
            start_download,
            pause_download,
            resume_download,
            cancel_download,
            remove_task,
            clear_all_tasks,
            get_download,
            get_task,
            list_downloads,
            list_tasks,
            get_default_directory,
            check_extractor_status,
            install_extractor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
