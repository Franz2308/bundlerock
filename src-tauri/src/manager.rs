use crate::engine::{
    divide_ranges, download_segment_worker, download_single_stream_worker,
    SegmentProgressUpdate,
};
use crate::media_extractor::{
    detect_platform, download_media_stream, get_extractor_status, install_ytdlp, probe_media,
};
use crate::models::{
    now_millis, DownloadProgressPayload, DownloadSegment, DownloadStatus, DownloadTask,
    ExtractorStatus, ProbeResult,
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
    tasks_file: PathBuf,
}

impl DownloadManager {
    pub fn save_tasks_map(tasks: &HashMap<String, DownloadTask>, path: &PathBuf) {
        let tasks_vec: Vec<&crate::models::DownloadTask> = tasks.values().collect();
        if let Ok(json) = serde_json::to_string(&tasks_vec) {
            let _ = std::fs::write(path, json);
        }
    }

    pub async fn save_tasks(&self) {
        let tasks = self.tasks.read().await;
        Self::save_tasks_map(&*tasks, &self.tasks_file);
    }

    pub fn load_tasks(path: &PathBuf) -> HashMap<String, DownloadTask> {
        if let Ok(json) = std::fs::read_to_string(path) {
            if let Ok(tasks_vec) = serde_json::from_str::<Vec<DownloadTask>>(&json) {
                let mut map = HashMap::new();
                for mut t in tasks_vec {
                    if t.status == DownloadStatus::Downloading {
                        t.status = DownloadStatus::Paused;
                        t.speed_bps = 0;
                    }
                    map.insert(t.id.clone(), t);
                }
                return map;
            }
        }
        HashMap::new()
    }

    pub fn new(app_handle: tauri::AppHandle) -> Self {
        use tauri::Manager;
        let data_dir = app_handle.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("tasks_data"));
        let _ = std::fs::create_dir_all(&data_dir);
        let tasks_file = data_dir.join("tasks.json");

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            tasks: Arc::new(RwLock::new(Self::load_tasks(&tasks_file))),
            controllers: Arc::new(Mutex::new(HashMap::new())),
            client,
            tasks_file,
        }
    }

    /// Probes a URL to discover size, range support, and filename.
    /// If URL is a social media / multimedia stream (Level 1: YouTube, Twitter/X; Level 2: Facebook; Level 3: Reddit),
    /// extracts multimedia metadata, thumbnail, duration, and available format resolutions.
    pub async fn probe(&self, url: &str) -> Result<ProbeResult, String> {
        let clean_url = url.trim();
        let normalized_url = if !clean_url.starts_with("http://") && !clean_url.starts_with("https://") {
            format!("https://{clean_url}")
        } else {
            clean_url.to_string()
        };

        if let Some((_platform, _level, _display)) = detect_platform(&normalized_url) {
            match probe_media(&self.client, &normalized_url).await {
                Ok(media_info) => {
                    let has_formats = !media_info.formats.is_empty();
                    let default_ext = if has_formats {
                        media_info
                            .formats
                            .first()
                            .map(|f| f.ext.as_str())
                            .unwrap_or("mp4")
                    } else if let Some(first_gallery) = media_info.gallery_items.first() {
                        let path = url::Url::parse(&first_gallery.url)
                            .map(|u| u.path().to_ascii_lowercase())
                            .unwrap_or_default();
                        if path.ends_with(".png") || first_gallery.url.contains("format=png") {
                            "png"
                        } else if path.ends_with(".webp") || first_gallery.url.contains("format=webp") {
                            "webp"
                        } else {
                            "jpg"
                        }
                    } else {
                        "mp4"
                    };

                    let clean_title = if media_info.title.trim().is_empty() {
                        if !has_formats && !media_info.gallery_items.is_empty() {
                            "galeria_imagenes"
                        } else {
                            "video_multimedia"
                        }
                    } else {
                        &media_info.title
                    };

                    let sanitized = crate::probe::sanitize_filename(clean_title);
                    let stem = sanitized.strip_suffix(".bin").unwrap_or(&sanitized);
                    let file_name = format!("{stem}.{default_ext}");
                    let approx_size = media_info.formats.first().and_then(|f| f.filesize_approx);

                    let content_type = if !has_formats && !media_info.gallery_items.is_empty() {
                        Some(format!("image/{default_ext}"))
                    } else {
                        Some(format!("video/{default_ext}"))
                    };

                    return Ok(ProbeResult {
                        url: normalized_url,
                        file_name,
                        content_length: approx_size,
                        accept_ranges: true,
                        etag: None,
                        content_type,
                        suggested_connections: 4,
                        media_info: Some(media_info),
                    });
                }
                Err(e) => {
                    eprintln!("Media probe error, falling back to standard probe: {e}");
                }
            }
        }

        probe_url(&self.client, &normalized_url).await
    }

    /// Gets extractor status (yt-dlp and ffmpeg)
    pub fn get_extractor_status(&self) -> ExtractorStatus {
        get_extractor_status()
    }

    /// Automatically installs yt-dlp binary
    pub async fn install_extractor(&self) -> Result<String, String> {
        install_ytdlp(&self.client).await
    }

    /// Starts a new download task.
    pub async fn start_download(
        &self,
        url: &str,
        save_path: Option<String>,
        custom_file_name: Option<String>,
        connections: Option<usize>,
        format_id: Option<String>,
        resolution: Option<String>,
        thumbnail_url: Option<String>,
        duration_seconds: Option<u64>,
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
                let mut p = PathBuf::from(path_str);
                if !p.is_absolute() {
                    p = get_default_download_dir().join(p);
                }
                if p.is_dir()
                    || path_str.ends_with('/')
                    || path_str.ends_with('\\')
                    || (p.extension().is_none() && custom_file_name.is_some())
                {
                    p.join(&initial_name)
                } else if custom_file_name.is_none() && p.extension().is_some() {
                    p
                } else {
                    p.join(&initial_name)
                }
            }
            None => get_default_download_dir().join(&initial_name),
        };

        // Ensure unique name to avoid clobbering existing files on disk
        let destination_path = if base_destination.exists() {
            resolve_unique_file_path(base_destination)
        } else {
            base_destination
        };

        // Ensure parent directory exists
        if let Some(parent) = destination_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

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

        // Set rich metadata
        task.resolution = resolution;
        task.thumbnail_url = thumbnail_url.clone();
        task.media_thumbnail = thumbnail_url;
        task.duration_seconds = duration_seconds;
        task.media_duration = duration_seconds;

        // Check if multimedia task
        if let Some(media) = probe.media_info {
            if crate::media_extractor::find_ytdlp().is_none() {
                return Err("Motor extractor multimedia (yt-dlp) no encontrado. Por favor instálalo desde la ventana de descarga antes de iniciar la descarga.".to_string());
            }

            task.is_media = true;
            task.is_animated_gif = media.is_animated_gif;
            if task.thumbnail_url.is_none() {
                task.thumbnail_url = media.thumbnail_url.clone();
                task.media_thumbnail = media.thumbnail_url;
            }
            if task.duration_seconds.is_none() {
                task.duration_seconds = media.duration_seconds;
                task.media_duration = media.duration_seconds;
            }
            task.media_platform = Some(format!(
                "{} (Nivel {})",
                media.platform_display, media.platform_level
            ));
            task.media_format = format_id.clone();
            task.status = DownloadStatus::Downloading;

            if task.resolution.is_none() {
                if let Some(ref fid) = format_id {
                    if let Some(fmt_opt) = media.formats.iter().find(|f| &f.format_id == fid) {
                        task.resolution = fmt_opt.resolution.clone();
                    }
                }
                if task.resolution.is_none() {
                    if let Some(first_fmt) = media.formats.first() {
                        task.resolution = first_fmt.resolution.clone();
                    }
                }
            }

            let total = task.total_bytes.unwrap_or(0);
            task.segments = vec![DownloadSegment::new(
                0,
                0,
                if total > 0 { total - 1 } else { 0 },
            )];

            let session_id = SESSION_COUNTER.fetch_add(1, Ordering::SeqCst);
            let (cancel_tx, cancel_rx) = watch::channel(false);

            {
                let mut controllers = self.controllers.lock().await;
                controllers.insert(
                    task_id.clone(),
                    ActiveController {
                        session_id,
                        cancel_tx,
                    },
                );
            }

            {
                let mut tasks = self.tasks.write().await;
                tasks.insert(task_id.clone(), task.clone());
            }

            let task_for_stream = task.clone();
            let tasks_arc = self.tasks.clone();
            let tasks_file_clone = self.tasks_file.clone();
            tokio::spawn(async move {
                let _ = download_media_stream(
                    task_for_stream,
                    format_id,
                    app_handle,
                    cancel_rx,
                    tasks_arc,
                    tasks_file_clone,
                )
                .await;
            });

            self.save_tasks().await;
            return Ok(task);
        }

        // Step 2: Initialize segments for standard HTTP downloads
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
            Self::save_tasks_map(&*tasks, &self.tasks_file);
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

        self.save_tasks().await;
        Ok(task)
    }

    /// Pauses an ongoing download.
    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let mut controllers = self.controllers.lock().await;
        if let Some(ctrl) = controllers.remove(id) {
            let _ = ctrl.cancel_tx.send(true);
        }

        let mut tasks = self.tasks.write().await;
        let mut mutated = false;
        if let Some(task) = tasks.get_mut(id) {
            if task.status == DownloadStatus::Downloading {
                task.status = DownloadStatus::Paused;
                task.speed_bps = 0;
                task.updated_at = now_millis();
                mutated = true;
            }
        }
        
        if mutated {
            Self::save_tasks_map(&*tasks, &self.tasks_file);
            return Ok(());
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

        if task.is_media {
            let session_id = SESSION_COUNTER.fetch_add(1, Ordering::SeqCst);
            let (cancel_tx, cancel_rx) = watch::channel(false);

            {
                let mut controllers = self.controllers.lock().await;
                controllers.insert(
                    id.to_string(),
                    ActiveController {
                        session_id,
                        cancel_tx,
                    },
                );
            }

            let task_for_stream = task.clone();
            let tasks_arc = self.tasks.clone();
            let fmt = task.media_format.clone();
            let tasks_file_clone = self.tasks_file.clone();
            tokio::spawn(async move {
                let _ = download_media_stream(
                    task_for_stream,
                    fmt,
                    app_handle,
                    cancel_rx,
                    tasks_arc,
                    tasks_file_clone,
                )
                .await;
            });

            return Ok(());
        }

        self.spawn_download_supervisor(task, app_handle, false).await?;
        self.save_tasks().await;
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
            let path = {
                let task = tasks
                    .get_mut(id)
                    .ok_or_else(|| format!("Task {id} not found"))?;
                task.status = DownloadStatus::Cancelled;
                task.speed_bps = 0;
                task.updated_at = now_millis();
                PathBuf::from(&task.file_path)
            };
            Self::save_tasks_map(&*tasks, &self.tasks_file);
            path
        };

        if delete_file {
            // Small async delay to allow file handles to close on Windows
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(150)).await;
                if file_path.exists() {
                    let _ = std::fs::remove_file(&file_path);
                }
                let part_file = PathBuf::from(format!("{}.part", file_path.display()));
                if part_file.exists() {
                    let _ = std::fs::remove_file(part_file);
                }
                let ytdl_file = PathBuf::from(format!("{}.ytdl", file_path.display()));
                if ytdl_file.exists() {
                    let _ = std::fs::remove_file(ytdl_file);
                }
            });
        }

        Ok(())
    }

    /// Permanently removes a download task from memory and stops any active controller.
    /// Under BundleRock rules, delete_file is false by default: user's files on disk are NEVER deleted unless explicitly requested.
    pub async fn remove_task(&self, id: &str, delete_file: bool) -> Result<(), String> {
        // Stop active controller if running
        {
            let mut controllers = self.controllers.lock().await;
            if let Some(ctrl) = controllers.remove(id) {
                let _ = ctrl.cancel_tx.send(true);
            }
        }

        // Remove task from memory
        let removed_task = {
            let mut tasks = self.tasks.write().await;
            let rm = tasks.remove(id);
            Self::save_tasks_map(&*tasks, &self.tasks_file);
            rm
        };

        let task = removed_task.ok_or_else(|| format!("Task {id} not found"))?;

        if delete_file {
            let file_path = PathBuf::from(&task.file_path);
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(150)).await;
                if file_path.exists() {
                    let _ = std::fs::remove_file(&file_path);
                }
                let part_file = PathBuf::from(format!("{}.part", file_path.display()));
                if part_file.exists() {
                    let _ = std::fs::remove_file(part_file);
                }
                let ytdl_file = PathBuf::from(format!("{}.ytdl", file_path.display()));
                if ytdl_file.exists() {
                    let _ = std::fs::remove_file(ytdl_file);
                }
            });
        }

        Ok(())
    }

    /// Clears all download tasks from memory and stops all active controllers.
    /// Under BundleRock rules, delete_file is false by default: downloaded files remain intact on disk.
    pub async fn clear_all_tasks(&self, delete_file: bool) -> Result<(), String> {
        // Stop all active controllers
        {
            let mut controllers = self.controllers.lock().await;
            for (_, ctrl) in controllers.drain() {
                let _ = ctrl.cancel_tx.send(true);
            }
        }

        // Drain all tasks from memory
        let tasks_to_clear: Vec<DownloadTask> = {
            let mut tasks = self.tasks.write().await;
            let drained: Vec<_> = tasks.drain().map(|(_, v)| v).collect();
            Self::save_tasks_map(&*tasks, &self.tasks_file);
            drained
        };

        if delete_file {
            for task in tasks_to_clear {
                let file_path = PathBuf::from(&task.file_path);
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(150)).await;
                    if file_path.exists() {
                        let _ = std::fs::remove_file(&file_path);
                    }
                    let part_file = PathBuf::from(format!("{}.part", file_path.display()));
                    if part_file.exists() {
                        let _ = std::fs::remove_file(part_file);
                    }
                    let ytdl_file = PathBuf::from(format!("{}.ytdl", file_path.display()));
                    if ytdl_file.exists() {
                        let _ = std::fs::remove_file(ytdl_file);
                    }
                });
            }
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
        let tasks_file_clone = self.tasks_file.clone();

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

                        // Persist snapshot in tasks map only if task is still actively present
                        let mut tasks = tasks_map.write().await;
                        if let Some(stored) = tasks.get_mut(&task_id) {
                            if stored.status == DownloadStatus::Downloading {
                                *stored = task.clone();
                            }
                            // Emit periodic event to frontend only if task still exists in manager
                            if let Some(ref app) = app_handle {
                                let payload = DownloadProgressPayload::from(&task);
                                let _ = app.emit("download-progress", payload);
                            }
                        }
                    }
                }
            }

            // Guard: If task was removed via remove_task or clear_all_tasks while running, do not resurrect or emit events
            let is_still_in_map = {
                let tasks = tasks_map.read().await;
                tasks.contains_key(&task_id)
            };

            if !is_still_in_map {
                let mut controllers = controllers_map.lock().await;
                if let Some(ctrl) = controllers.get(&task_id) {
                    if ctrl.session_id == session_id {
                        controllers.remove(&task_id);
                    }
                }
                return;
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
                let mut mutated = false;
                if let Some(stored) = tasks.get_mut(&task_id) {
                    // Do not overwrite if a newer download session has started
                    if stored.status == DownloadStatus::Downloading
                        || task.status == DownloadStatus::Completed
                        || task.status == DownloadStatus::Failed
                    {
                        *stored = task.clone();
                        mutated = true;
                    }
                }
                if mutated {
                    Self::save_tasks_map(&*tasks, &tasks_file_clone);
                }
            }
        });

        Ok(())
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

        let res = manager.remove_task("non-existent", false).await;
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_remove_and_clear_tasks() {
        let manager = DownloadManager::new();

        // Insert mock tasks directly into manager
        {
            let mut tasks = manager.tasks.write().await;
            tasks.insert(
                "task-1".to_string(),
                DownloadTask::new(
                    "task-1".to_string(),
                    "https://example.com/file1.zip".to_string(),
                    "/tmp/file1.zip".to_string(),
                    "file1.zip".to_string(),
                    Some(100),
                    true,
                    None,
                    4,
                ),
            );
            tasks.insert(
                "task-2".to_string(),
                DownloadTask::new(
                    "task-2".to_string(),
                    "https://example.com/file2.zip".to_string(),
                    "/tmp/file2.zip".to_string(),
                    "file2.zip".to_string(),
                    Some(200),
                    true,
                    None,
                    4,
                ),
            );
        }

        assert_eq!(manager.list_tasks().await.len(), 2);

        // Remove task-1
        let res = manager.remove_task("task-1", false).await;
        assert!(res.is_ok());
        assert_eq!(manager.list_tasks().await.len(), 1);
        assert!(manager.get_task("task-1").await.is_none());
        assert!(manager.get_task("task-2").await.is_some());

        // Clear all tasks
        let res = manager.clear_all_tasks(false).await;
        assert!(res.is_ok());
        assert_eq!(manager.list_tasks().await.len(), 0);
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
