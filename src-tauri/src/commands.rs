use crate::manager::DownloadManager;
use crate::models::{DownloadTask, ProbeResult};
use tauri::{AppHandle, State};

/// Probes a download URL to detect file size, range support, ETag, and file name.
#[tauri::command]
pub async fn probe_url(
    url: String,
    manager: State<'_, DownloadManager>,
) -> Result<ProbeResult, String> {
    manager.probe(&url).await
}

/// Starts an accelerated segmented download.
#[tauri::command]
pub async fn start_download(
    url: String,
    save_path: Option<String>,
    file_name: Option<String>,
    connections: Option<usize>,
    app: AppHandle,
    manager: State<'_, DownloadManager>,
) -> Result<DownloadTask, String> {
    manager
        .start_download(&url, save_path, file_name, connections, Some(app))
        .await
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

/// Lists all current and past download tasks.
#[tauri::command]
pub async fn list_downloads(
    manager: State<'_, DownloadManager>,
) -> Result<Vec<DownloadTask>, String> {
    Ok(manager.list_tasks().await)
}
