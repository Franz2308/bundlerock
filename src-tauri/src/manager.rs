use crate::engine::{
    divide_ranges, download_segment_worker, download_single_stream_worker,
    SegmentProgressUpdate,
};
use crate::models::{
    now_millis, DownloadProgressPayload, DownloadSegment, DownloadStatus, DownloadTask,
    ProbeResult,
};
use crate::probe::probe_url;
use crate::storage::StorageFile;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::sync::{mpsc, watch, Mutex, RwLock};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);

struct ActiveController {
    session_id: u64,
    cancel_tx: watch::Sender<bool>,
}

pub struct DownloadManager {
    tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
    controllers: Arc<Mutex<HashMap<String, ActiveController>>>,
    client: reqwest::Client,
}

impl DownloadManager {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            controllers: Arc::new(Mutex::new(HashMap::new())),
            client,
        }
    }

    /// Probes a URL to discover size, range support, and filename.
    pub async fn probe(&self, url: &str) -> Result<ProbeResult, String> {
        probe_url(&self.client, url).await
    }

    /// Starts a new download task.
    pub async fn start_download(
        &self,
        url: &str,
        save_path: Option<String>,
        custom_file_name: Option<String>,
        connections: Option<usize>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<DownloadTask, String> {
        // Step 1: Probe URL
        let probe = self.probe(url).await?;

        let initial_name = custom_file_name
            .as_ref()
            .filter(|n| !n.trim().is_empty())
            .cloned()
            .unwrap_or(probe.file_name);

        let base_destination = match save_path {
            Some(ref path_str) => {
                let p = PathBuf::from(path_str);
                if p.is_dir() || path_str.ends_with('/') || path_str.ends_with('\\') {
                    p.join(&initial_name)
                } else if custom_file_name.is_none() && p.extension().is_some() {
                    p
                } else {
                    p.parent().unwrap_or(&p).join(&initial_name)
                }
            }
            None => get_default_download_dir().join(&initial_name),
        };

        // If not explicitly naming a custom file, ensure unique name to avoid clobbering existing files
        let destination_path = if custom_file_name.is_none() && base_destination.exists() {
            resolve_unique_file_path(base_destination)
        } else {
            base_destination
        };

        let file_name = destination_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&initial_name)
            .to_string();

        let num_connections = connections.unwrap_or(probe.suggested_connections).max(1);
        let task_id = uuid::Uuid::new_v4().to_string();

        let mut task = DownloadTask::new(
            task_id.clone(),
            url.to_string(),
            destination_path.to_string_lossy().to_string(),
            file_name,
            probe.content_length,
            probe.accept_ranges,
            probe.etag,
            num_connections,
        );

        // Step 2: Initialize segments
        if probe.accept_ranges && probe.content_length.is_some() {
            let total = probe.content_length.unwrap();
            task.segments = divide_ranges(total, num_connections);
        } else {
            // Single segment for non-resumable or unknown length
            let end_byte = probe
                .content_length
                .map(|l| if l > 0 { l - 1 } else { 0 })
                .unwrap_or(u64::MAX);
            task.segments = vec![DownloadSegment::new(0, 0, end_byte)];
        }

        task.status = DownloadStatus::Downloading;

        // If file is 0 bytes, mark completed immediately without network requests
        if let Some(0) = task.total_bytes {
            task.status = DownloadStatus::Completed;
            task.progress_percentage = 100.0;
            // Create empty file
            let _ = StorageFile::open_or_create(&destination_path, Some(0), true);

            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task.clone());
            return Ok(task);
        }

        // Save task in registry
        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task.clone());
        }

        // Step 3: Spawn supervisor task
        self.spawn_download_supervisor(task.clone(), app_handle, true)
            .await?;

        Ok(task)
    }

    /// Pauses an ongoing download.
    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let mut controllers = self.controllers.lock().await;
        if let Some(ctrl) = controllers.remove(id) {
            let _ = ctrl.cancel_tx.send(true);
        }

        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(id) {
            if task.status == DownloadStatus::Downloading {
                task.status = DownloadStatus::Paused;
                task.speed_bps = 0;
                task.updated_at = now_millis();
                return Ok(());
            }
        }

        Err(format!("Task {id} is not downloading or does not exist"))
    }

    /// Resumes a paused download.
    pub async fn resume_download(
        &self,
        id: &str,
        app_handle: Option<tauri::AppHandle>,
    ) -> Result<(), String> {
        let task = {
            let mut tasks = self.tasks.write().await;
            let task = tasks
                .get_mut(id)
                .ok_or_else(|| format!("Task {id} not found"))?;

            if task.status == DownloadStatus::Completed {
                return Err("Task already completed".to_string());
            }

            if task.status == DownloadStatus::Downloading {
                return Err("Task is already downloading".to_string());
            }

            if task.status == DownloadStatus::Cancelled {
                return Err("Task was cancelled".to_string());
            }

            task.status = DownloadStatus::Downloading;
            task.error_message = None;
            task.updated_at = now_millis();
            task.clone()
        };

        // Stop any lingering previous controller before resuming
        {
            let mut controllers = self.controllers.lock().await;
            if let Some(ctrl) = controllers.remove(id) {
                let _ = ctrl.cancel_tx.send(true);
            }
        }

        self.spawn_download_supervisor(task, app_handle, false).await?;
        Ok(())
    }

    /// Cancels a download task and optionally deletes the partially downloaded file.
    pub async fn cancel_download(&self, id: &str, delete_file: bool) -> Result<(), String> {
        // Stop workers
        {
            let mut controllers = self.controllers.lock().await;
            if let Some(ctrl) = controllers.remove(id) {
                let _ = ctrl.cancel_tx.send(true);
            }
        }

        let file_path = {
            let mut tasks = self.tasks.write().await;
            let task = tasks
                .get_mut(id)
                .ok_or_else(|| format!("Task {id} not found"))?;
            task.status = DownloadStatus::Cancelled;
            task.speed_bps = 0;
            task.updated_at = now_millis();
            PathBuf::from(&task.file_path)
        };

        if delete_file {
            // Small async delay to allow file handles to close on Windows
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(150)).await;
                if file_path.exists() {
                    let _ = std::fs::remove_file(file_path);
                }
            });
        }

        Ok(())
    }

    /// Gets a snapshot of a download task.
    pub async fn get_task(&self, id: &str) -> Option<DownloadTask> {
        let tasks = self.tasks.read().await;
        tasks.get(id).cloned()
    }

    /// Lists all download tasks.
    pub async fn list_tasks(&self) -> Vec<DownloadTask> {
        let tasks = self.tasks.read().await;
        tasks.values().cloned().collect()
    }

    /// Spawns the supervisor that launches segment download workers and aggregates progress.
    async fn spawn_download_supervisor(
        &self,
        mut task: DownloadTask,
        app_handle: Option<tauri::AppHandle>,
        is_new: bool,
    ) -> Result<(), String> {
        let session_id = SESSION_COUNTER.fetch_add(1, Ordering::SeqCst);
        let (cancel_tx, cancel_rx) = watch::channel(false);

        {
            let mut controllers = self.controllers.lock().await;
            controllers.insert(
                task.id.clone(),
                ActiveController {
                    session_id,
                    cancel_tx: cancel_tx.clone(),
                },
            );
        }

        let target_path = PathBuf::from(&task.file_path);
        let storage = StorageFile::open_or_create(&target_path, task.total_bytes, is_new)
            .map_err(|e| format!("Failed to open storage file: {e}"))?;
        let storage_arc = Arc::new(storage);

        let (progress_tx, mut progress_rx) = mpsc::channel::<SegmentProgressUpdate>(512);

        let client = self.client.clone();
        let url = task.url.clone();
        let etag = task.etag.clone();
        let is_multi_segment =
            task.accept_ranges && task.total_bytes.is_some() && task.segments.len() > 1;

        // Spawn worker tasks
        if is_multi_segment {
            for segment in task.segments.iter() {
                if !segment.is_finished() {
                    let seg_clone = segment.clone();
                    let client_clone = client.clone();
                    let url_clone = url.clone();
                    let etag_clone = etag.clone();
                    let storage_clone = storage_arc.clone();
                    let tx_clone = progress_tx.clone();
                    let rx_clone = cancel_rx.clone();

                    tokio::spawn(async move {
                        download_segment_worker(
                            client_clone,
                            url_clone,
                            seg_clone,
                            etag_clone,
                            storage_clone,
                            tx_clone,
                            rx_clone,
                        )
                        .await;
                    });
                }
            }
        } else {
            // Single stream worker
            let start_byte = task.segments.first().map(|s| s.current_byte).unwrap_or(0);
            let client_clone = client.clone();
            let url_clone = url.clone();
            let etag_clone = etag.clone();
            let storage_clone = storage_arc.clone();
            let tx_clone = progress_tx.clone();
            let rx_clone = cancel_rx.clone();

            tokio::spawn(async move {
                download_single_stream_worker(
                    client_clone,
                    url_clone,
                    etag_clone,
                    storage_clone,
                    tx_clone,
                    rx_clone,
                    start_byte,
                )
                .await;
            });
        }

        // Drop initial sender so progress_rx closes when all workers finish
        drop(progress_tx);

        let tasks_map = self.tasks.clone();
        let controllers_map = self.controllers.clone();
        let task_id = task.id.clone();

        // Spawn supervisor loop
        tokio::spawn(async move {
            let mut last_speed_check = Instant::now();
            let mut bytes_since_last_check: u64 = 0;
            let mut ticker = tokio::time::interval(Duration::from_millis(250));
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    update_opt = progress_rx.recv() => {
                        match update_opt {
                            Some(update) => {
                                bytes_since_last_check += update.bytes_written;

                                // Update segment in task
                                if let Some(seg) = task.segments.get_mut(update.segment_id) {
                                    seg.current_byte = update.current_byte;
                                    seg.downloaded_bytes = seg.current_byte.saturating_sub(seg.start_byte);
                                    seg.status = update.status;
                                }

                                if let Some(err) = update.error {
                                    task.status = DownloadStatus::Failed;
                                    task.error_message = Some(err);
                                    task.speed_bps = 0;
                                    // Terminate sibling workers on failure
                                    let _ = cancel_tx.send(true);
                                    break;
                                }

                                task.recalculate_progress();
                            }
                            None => {
                                // All workers terminated
                                break;
                            }
                        }
                    }
                    _ = ticker.tick() => {
                        let elapsed = last_speed_check.elapsed().as_secs_f64();
                        if elapsed > 0.0 {
                            let current_bps = (bytes_since_last_check as f64 / elapsed) as u64;
                            // Decaying exponential moving average (70% current, 30% previous)
                            task.speed_bps = ((task.speed_bps as f64 * 0.3) + (current_bps as f64 * 0.7)) as u64;
                        }
                        bytes_since_last_check = 0;
                        last_speed_check = Instant::now();

                        task.recalculate_progress();

                        // Emit periodic event to frontend
                        if let Some(ref app) = app_handle {
                            let payload = DownloadProgressPayload::from(&task);
                            let _ = app.emit("download-progress", payload);
                        }

                        // Persist snapshot in tasks map
                        let mut tasks = tasks_map.write().await;
                        if let Some(stored) = tasks.get_mut(&task_id) {
                            if stored.status == DownloadStatus::Downloading {
                                *stored = task.clone();
                            }
                        }
                    }
                }
            }

            // Sync storage buffer to disk
            let _ = storage_arc.sync();

            // Evaluate completion state
            let all_finished = task.segments.iter().all(|s| s.is_finished());

            if task.status != DownloadStatus::Failed && task.status != DownloadStatus::Cancelled {
                if all_finished {
                    task.status = DownloadStatus::Completed;
                    task.progress_percentage = 100.0;
                    task.speed_bps = 0;
                    if let Some(total) = task.total_bytes {
                        task.downloaded_bytes = total;
                    } else {
                        task.total_bytes = Some(task.downloaded_bytes);
                    }
                    if let Some(ref app) = app_handle {
                        let _ = app.emit("download-finished", task.clone());
                    }
                } else if task.status == DownloadStatus::Downloading {
                    task.status = DownloadStatus::Paused;
                    task.speed_bps = 0;
                }
            }

            task.recalculate_progress();

            // Emit final event
            if let Some(ref app) = app_handle {
                let payload = DownloadProgressPayload::from(&task);
                let _ = app.emit("download-progress", payload);
            }

            // Clean up session controller only if it matches our session_id
            {
                let mut controllers = controllers_map.lock().await;
                if let Some(ctrl) = controllers.get(&task_id) {
                    if ctrl.session_id == session_id {
                        controllers.remove(&task_id);
                    }
                }
            }

            // Update task in map
            {
                let mut tasks = tasks_map.write().await;
                if let Some(stored) = tasks.get_mut(&task_id) {
                    // Do not overwrite if a newer download session has started
                    if stored.status == DownloadStatus::Downloading
                        || task.status == DownloadStatus::Completed
                        || task.status == DownloadStatus::Failed
                    {
                        *stored = task.clone();
                    }
                }
            }
        });

        Ok(())
    }
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Resolves a non-colliding file path by appending `(1)`, `(2)`, etc. if file already exists.
pub fn resolve_unique_file_path(target_path: PathBuf) -> PathBuf {
    if !target_path.exists() {
        return target_path;
    }

    let parent = target_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let extension = target_path.extension().and_then(|e| e.to_str());

    for counter in 1..10000 {
        let new_name = match extension {
            Some(ext) => format!("{file_stem} ({counter}).{ext}"),
            None => format!("{file_stem} ({counter})"),
        };
        let candidate = parent.join(&new_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    target_path
}

pub fn get_default_download_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let p = PathBuf::from(profile).join("Downloads");
            if p.exists() {
                return p;
            }
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_manager_task_lifecycle() {
        let manager = DownloadManager::new();

        let tasks = manager.list_tasks().await;
        assert!(tasks.is_empty());

        let res = manager.pause_download("non-existent").await;
        assert!(res.is_err());

        let res = manager.resume_download("non-existent", None).await;
        assert!(res.is_err());

        let res = manager.cancel_download("non-existent", false).await;
        assert!(res.is_err());
    }

    #[test]
    fn test_resolve_unique_file_path() {
        let temp_dir = std::env::temp_dir();
        let unique_base = format!("bundlerock_unique_test_{}", uuid::Uuid::new_v4());
        let file_path = temp_dir.join(format!("{unique_base}.txt"));

        // When file does not exist, returns original
        let resolved = resolve_unique_file_path(file_path.clone());
        assert_eq!(resolved, file_path);

        // When file exists, returns (1)
        std::fs::write(&file_path, b"test").expect("write test file");
        let resolved_collided = resolve_unique_file_path(file_path.clone());
        assert_ne!(resolved_collided, file_path);
        assert!(resolved_collided
            .to_string_lossy()
            .contains(&format!("{unique_base} (1).txt")));

        let _ = std::fs::remove_file(file_path);
    }

    #[test]
    fn test_default_download_dir_not_empty() {
        let dir = get_default_download_dir();
        assert!(!dir.as_os_str().is_empty());
    }
}
