use crate::manager::DownloadManager;
use crate::models::{DownloadTask, ExtractorStatus, ProbeResult};
use tauri::{AppHandle, State};

/// Probes a download URL to detect file size, range support, ETag, and file name (or multimedia streams).
#[tauri::command]
pub async fn probe_url(
    url: String,
    manager: State<'_, DownloadManager>,
) -> Result<ProbeResult, String> {
    manager.probe(&url).await
}

/// Starts an accelerated segmented download or multimedia download.
#[tauri::command]
pub async fn start_download(
    url: String,
    save_path: Option<String>,
    destination_path: Option<String>,
    file_name: Option<String>,
    connections: Option<usize>,
    format_id: Option<String>,
    app: AppHandle,
    manager: State<'_, DownloadManager>,
) -> Result<DownloadTask, String> {
    let final_path = save_path.or(destination_path);
    manager
        .start_download(&url, final_path, file_name, connections, format_id, Some(app))
        .await
}

/// Checks availability of multimedia extractor engine (yt-dlp and ffmpeg).
#[tauri::command]
pub fn check_extractor_status(manager: State<'_, DownloadManager>) -> ExtractorStatus {
    manager.get_extractor_status()
}

/// Automatically downloads and installs yt-dlp into BundleRock's bin directory.
#[tauri::command]
pub async fn install_extractor(
    manager: State<'_, DownloadManager>,
) -> Result<String, String> {
    manager.install_extractor().await
}

/// Pauses an active download.
#[tauri::command]
pub async fn pause_download(
    id: String,
    manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    manager.pause_download(&id).await
}

/// Resumes a paused download.
#[tauri::command]
pub async fn resume_download(
    id: String,
    app: AppHandle,
    manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    manager.resume_download(&id, Some(app)).await
}

/// Cancels a download task and optionally deletes the file from disk.
#[tauri::command]
pub async fn cancel_download(
    id: String,
    delete_file: Option<bool>,
    manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    manager
        .cancel_download(&id, delete_file.unwrap_or(false))
        .await
}

/// Retrieves the status and details of a single download task.
#[tauri::command]
pub async fn get_download(
    id: String,
    manager: State<'_, DownloadManager>,
) -> Result<DownloadTask, String> {
    manager
        .get_task(&id)
        .await
        .ok_or_else(|| format!("Task {id} not found"))
}

/// Alias for get_download
#[tauri::command]
pub async fn get_task(
    id: String,
    manager: State<'_, DownloadManager>,
) -> Result<Option<DownloadTask>, String> {
    Ok(manager.get_task(&id).await)
}

/// Lists all current and past download tasks.
#[tauri::command]
pub async fn list_downloads(
    manager: State<'_, DownloadManager>,
) -> Result<Vec<DownloadTask>, String> {
    Ok(manager.list_tasks().await)
}

/// Alias for list_downloads
#[tauri::command]
pub async fn list_tasks(
    manager: State<'_, DownloadManager>,
) -> Result<Vec<DownloadTask>, String> {
    Ok(manager.list_tasks().await)
}

/// Gets the system default download directory
#[tauri::command]
pub fn get_default_directory() -> String {
    crate::manager::get_default_download_dir()
        .to_string_lossy()
        .to_string()
}
