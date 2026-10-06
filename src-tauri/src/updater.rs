//! Automatic updates module for BundleRock.
//! Interacts with GitHub Releases via tauri-plugin-updater v2,
//! handles cryptographic signature validation, background download
//! with progress reporting, graceful task cleanup, and installer launch.

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;
use crate::manager::DownloadManager;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateProgressPayload {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percentage: f64,
}

pub struct UpdaterState {
    pub pending_update: Mutex<Option<Update>>,
}

impl UpdaterState {
    pub fn new() -> Self {
        Self {
            pending_update: Mutex::new(None),
        }
    }
}

/// Returns the current application package version string (e.g. "0.2.3").
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Checks GitHub Releases endpoint for an available update.
/// Returns metadata about the update if found.
#[tauri::command]
pub async fn check_for_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update_opt = updater.check().await.map_err(|e| e.to_string())?;

    if let Some(update) = update_opt {
        let date_str = update.date.and_then(|d| {
            d.format(&time::format_description::well_known::Rfc3339).ok()
        });
        let info = UpdateInfo {
            available: true,
            current_version: update.current_version.clone(),
            version: Some(update.version.clone()),
            body: update.body.clone(),
            date: date_str,
        };
        let mut lock = state.pending_update.lock().await;
        *lock = Some(update);
        Ok(info)
    } else {
        Ok(UpdateInfo {
            available: false,
            current_version: app.package_info().version.to_string(),
            version: None,
            body: None,
            date: None,
        })
    }
}

/// Downloads, verifies and launches the update installer.
/// Stops and persists all active downloads beforehand.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, UpdaterState>,
    download_manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    let update = {
        let mut lock = state.pending_update.lock().await;
        match lock.take() {
            Some(u) => u,
            None => {
                let updater = app.updater().map_err(|e| e.to_string())?;
                updater
                    .check()
                    .await
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "No update available to install".to_string())?
            }
        }
    };

    // Cancel all active downloads cleanly and persist state to disk before installing
    download_manager.cancel_all_active().await;
    download_manager.save_tasks().await;

    let app_clone = app.clone();
    let mut downloaded: u64 = 0;

    update
        .download_and_install(
            move |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                let percentage = match content_length {
                    Some(total) if total > 0 => (downloaded as f64 / total as f64) * 100.0,
                    _ => 0.0,
                };
                let _ = app_clone.emit(
                    "update-progress",
                    UpdateProgressPayload {
                        downloaded_bytes: downloaded,
                        total_bytes: content_length,
                        percentage,
                    },
                );
            },
            || {
                // Download finished, installer verification and launch in progress
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
