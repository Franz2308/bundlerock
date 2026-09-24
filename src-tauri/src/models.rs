use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Pending,
    Probing,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SegmentStatus {
    Pending,
    Downloading,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DownloadSegment {
    pub id: usize,
    /// Inclusive start byte offset
    pub start_byte: u64,
    /// Inclusive end byte offset (or u64::MAX if unknown stream)
    pub end_byte: u64,
    /// Current write position (starts at start_byte, reaches end_byte + 1 when done)
    pub current_byte: u64,
    /// Bytes downloaded for this segment
    pub downloaded_bytes: u64,
    /// Total expected bytes for this segment (0 if unknown)
    pub total_bytes: u64,
    pub status: SegmentStatus,
}

impl DownloadSegment {
    pub fn new(id: usize, start_byte: u64, end_byte: u64) -> Self {
        let total_bytes = if end_byte >= start_byte && end_byte != u64::MAX {
            end_byte - start_byte + 1
        } else {
            0
        };

        Self {
            id,
            start_byte,
            end_byte,
            current_byte: start_byte,
            downloaded_bytes: 0,
            total_bytes,
            status: SegmentStatus::Pending,
        }
    }

    pub fn is_finished(&self) -> bool {
        self.status == SegmentStatus::Completed
            || (self.total_bytes > 0 && self.end_byte != u64::MAX && self.current_byte > self.end_byte)
            || (self.total_bytes > 0 && self.downloaded_bytes >= self.total_bytes)
    }

    pub fn remaining_bytes(&self) -> u64 {
        self.total_bytes.saturating_sub(self.downloaded_bytes)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SocialMediaPlatform {
    #[serde(rename = "youtube")]
    YouTube,
    #[serde(rename = "twitter")]
    Twitter,
    #[serde(rename = "facebook")]
    Facebook,
    #[serde(rename = "reddit")]
    Reddit,
    #[serde(other)]
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaGalleryItem {
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaFormatOption {
    pub format_id: String,
    pub quality_label: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub filesize_approx: Option<u64>,
    pub is_audio_only: bool,
    pub format_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaMetadata {
    pub title: String,
    pub uploader: Option<String>,
    pub thumbnail_url: Option<String>,
    pub duration_seconds: Option<u64>,
    pub platform: SocialMediaPlatform,
    pub platform_level: u8,
    pub platform_display: String,
    pub formats: Vec<MediaFormatOption>,
    #[serde(default)]
    pub gallery_items: Vec<MediaGalleryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExtractorStatus {
    pub ytdlp_installed: bool,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_installed: bool,
    pub ffmpeg_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub file_path: String,
    pub file_name: String,
    pub total_bytes: Option<u64>,
    pub downloaded_bytes: u64,
    pub status: DownloadStatus,
    pub etag: Option<String>,
    pub accept_ranges: bool,
    pub num_connections: usize,
    pub segments: Vec<DownloadSegment>,
    pub speed_bps: u64,
    pub progress_percentage: f64,
    pub created_at: u64,
    pub updated_at: u64,
    pub error_message: Option<String>,
    #[serde(default)]
    pub is_media: bool,
    #[serde(default)]
    pub media_thumbnail: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub media_duration: Option<u64>,
    #[serde(default)]
    pub duration_seconds: Option<u64>,
    #[serde(default)]
    pub media_platform: Option<String>,
    #[serde(default)]
    pub media_format: Option<String>,
    #[serde(default)]
    pub resolution: Option<String>,
    #[serde(default)]
    pub stage_message: Option<String>,
}

impl DownloadTask {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        id: String,
        url: String,
        file_path: String,
        file_name: String,
        total_bytes: Option<u64>,
        accept_ranges: bool,
        etag: Option<String>,
        num_connections: usize,
    ) -> Self {
        let now = now_millis();
        Self {
            id,
            url,
            file_path,
            file_name,
            total_bytes,
            downloaded_bytes: 0,
            status: DownloadStatus::Pending,
            etag,
            accept_ranges,
            num_connections,
            segments: Vec::new(),
            speed_bps: 0,
            progress_percentage: 0.0,
            created_at: now,
            updated_at: now,
            error_message: None,
            is_media: false,
            media_thumbnail: None,
            thumbnail_url: None,
            media_duration: None,
            duration_seconds: None,
            media_platform: None,
            media_format: None,
            resolution: None,
            stage_message: None,
        }
    }

    pub fn recalculate_progress(&mut self) {
        if !self.segments.is_empty() {
            self.downloaded_bytes = self.segments.iter().map(|s| s.downloaded_bytes).sum();
        }

        if let Some(total) = self.total_bytes {
            if total > 0 {
                let pct = (self.downloaded_bytes as f64 / total as f64) * 100.0;
                self.progress_percentage = pct.clamp(0.0, 100.0);
            } else {
                self.progress_percentage = 100.0;
            }
        }
        self.updated_at = now_millis();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeResult {
    pub url: String,
    pub file_name: String,
    pub content_length: Option<u64>,
    pub accept_ranges: bool,
    pub etag: Option<String>,
    pub content_type: Option<String>,
    pub suggested_connections: usize,
    #[serde(default)]
    pub media_info: Option<MediaMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub id: String,
    #[serde(default)]
    pub task_id: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bps: u64,
    pub progress_percentage: f64,
    #[serde(default)]
    pub progress_percent: Option<f64>,
    #[serde(default)]
    pub eta_secs: Option<u64>,
    pub status: DownloadStatus,
    pub segments: Vec<DownloadSegment>,
    pub error_message: Option<String>,
    #[serde(default)]
    pub is_media: bool,
    #[serde(default)]
    pub media_thumbnail: Option<String>,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub media_duration: Option<u64>,
    #[serde(default)]
    pub duration_seconds: Option<u64>,
    #[serde(default)]
    pub resolution: Option<String>,
    #[serde(default)]
    pub stage_message: Option<String>,
}

impl From<&DownloadTask> for DownloadProgressPayload {
    fn from(task: &DownloadTask) -> Self {
        let eta_secs = if task.speed_bps > 0 {
            task.total_bytes.and_then(|total| {
                if total > task.downloaded_bytes {
                    Some((total - task.downloaded_bytes) / task.speed_bps)
                } else {
                    Some(0)
                }
            })
        } else {
            None
        };

        Self {
            id: task.id.clone(),
            task_id: Some(task.id.clone()),
            downloaded_bytes: task.downloaded_bytes,
            total_bytes: task.total_bytes,
            speed_bps: task.speed_bps,
            progress_percentage: task.progress_percentage,
            progress_percent: Some(task.progress_percentage),
            eta_secs,
            status: task.status,
            segments: task.segments.clone(),
            error_message: task.error_message.clone(),
            is_media: task.is_media,
            media_thumbnail: task.media_thumbnail.clone(),
            thumbnail_url: task.thumbnail_url.clone().or_else(|| task.media_thumbnail.clone()),
            media_duration: task.media_duration,
            duration_seconds: task.duration_seconds.or(task.media_duration),
            resolution: task.resolution.clone(),
            stage_message: task.stage_message.clone(),
        }
    }
}

pub fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segment_creation_and_bounds() {
        let seg = DownloadSegment::new(0, 0, 99);
        assert_eq!(seg.total_bytes, 100);
        assert_eq!(seg.current_byte, 0);
        assert_eq!(seg.downloaded_bytes, 0);
        assert!(!seg.is_finished());

        let unknown_seg = DownloadSegment::new(0, 0, u64::MAX);
        assert_eq!(unknown_seg.total_bytes, 0);
        assert!(!unknown_seg.is_finished());
    }

    #[test]
    fn test_segment_is_finished() {
        let mut seg = DownloadSegment::new(0, 0, 99);
        seg.current_byte = 100;
        seg.downloaded_bytes = 100;
        assert!(seg.is_finished());

        let mut seg2 = DownloadSegment::new(1, 100, 199);
        seg2.status = SegmentStatus::Completed;
        assert!(seg2.is_finished());

        // Unknown size segment should only be finished if status == Completed
        let mut unknown = DownloadSegment::new(0, 0, u64::MAX);
        unknown.current_byte = 500;
        unknown.downloaded_bytes = 500;
        assert!(!unknown.is_finished());
        unknown.status = SegmentStatus::Completed;
        assert!(unknown.is_finished());
    }

    #[test]
    fn test_task_recalculate_progress() {
        let mut task = DownloadTask::new(
            "test-1".to_string(),
            "https://example.com/file.iso".to_string(),
            "/downloads/file.iso".to_string(),
            "file.iso".to_string(),
            Some(1000),
            true,
            None,
            2,
        );

        let mut seg0 = DownloadSegment::new(0, 0, 499);
        let mut seg1 = DownloadSegment::new(1, 500, 999);
        seg0.downloaded_bytes = 250;
        seg1.downloaded_bytes = 250;
        task.segments = vec![seg0, seg1];

        task.recalculate_progress();
        assert_eq!(task.downloaded_bytes, 500);
        assert!((task.progress_percentage - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_progress_payload_conversion() {
        let mut task = DownloadTask::new(
            "test-2".to_string(),
            "https://example.com/video.mp4".to_string(),
            "/downloads/video.mp4".to_string(),
            "video.mp4".to_string(),
            Some(2000),
            true,
            None,
            4,
        );
        task.downloaded_bytes = 1000;
        task.speed_bps = 500;
        task.progress_percentage = 50.0;

        let payload = DownloadProgressPayload::from(&task);
        assert_eq!(payload.id, "test-2");
        assert_eq!(payload.task_id, Some("test-2".to_string()));
        assert_eq!(payload.progress_percentage, 50.0);
        assert_eq!(payload.progress_percent, Some(50.0));
        assert_eq!(payload.eta_secs, Some(2)); // (2000 - 1000) / 500 = 2 seconds
    }

    #[test]
    fn test_media_task_and_probe_serialization() {
        let mut task = DownloadTask::new(
            "media-1".to_string(),
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string(),
            "/downloads/video.mp4".to_string(),
            "video.mp4".to_string(),
            Some(50_000_000),
            true,
            None,
            4,
        );
        task.is_media = true;
        task.media_thumbnail = Some("https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg".to_string());
        task.media_platform = Some("YouTube (Nivel 1)".to_string());
        task.media_duration = Some(212);
        task.stage_message = Some("Ensamblando audio y video con FFmpeg...".to_string());

        let payload = DownloadProgressPayload::from(&task);
        assert!(payload.is_media);
        assert_eq!(
            payload.stage_message,
            Some("Ensamblando audio y video con FFmpeg...".to_string())
        );

        let json = serde_json::to_string(&task).expect("serialize task");
        let deserialized: DownloadTask = serde_json::from_str(&json).expect("deserialize task");
        assert!(deserialized.is_media);
        assert_eq!(deserialized.media_duration, Some(212));
    }

    #[test]
    fn test_social_media_platform_serialization() {
        assert_eq!(serde_json::to_string(&SocialMediaPlatform::YouTube).unwrap(), "\"youtube\"");
        assert_eq!(serde_json::to_string(&SocialMediaPlatform::Twitter).unwrap(), "\"twitter\"");
        assert_eq!(serde_json::to_string(&SocialMediaPlatform::Facebook).unwrap(), "\"facebook\"");
        assert_eq!(serde_json::to_string(&SocialMediaPlatform::Reddit).unwrap(), "\"reddit\"");
        assert_eq!(serde_json::to_string(&SocialMediaPlatform::Other).unwrap(), "\"other\"");

        // Deserialization of unknown strings should map to Other
        let deserialized: SocialMediaPlatform = serde_json::from_str("\"instagram\"").unwrap();
        assert_eq!(deserialized, SocialMediaPlatform::Other);
    }

    #[test]
    fn test_gallery_items_and_metadata_serialization() {
        let gallery_item = MediaGalleryItem {
            url: "https://pbs.twimg.com/media/test.jpg".to_string(),
            thumbnail_url: Some("https://pbs.twimg.com/media/test_thumb.jpg".to_string()),
            width: Some(1920),
            height: Some(1080),
            index: 0,
        };

        let mut task = DownloadTask::new(
            "img-1".to_string(),
            "https://pbs.twimg.com/media/test.jpg".to_string(),
            "/downloads/test.jpg".to_string(),
            "test.jpg".to_string(),
            Some(1024),
            true,
            None,
            4,
        );
        task.resolution = Some("1920x1080".to_string());
        task.thumbnail_url = gallery_item.thumbnail_url.clone();
        task.media_thumbnail = gallery_item.thumbnail_url.clone();

        let json = serde_json::to_string(&task).expect("serialize task");
        let deserialized: DownloadTask = serde_json::from_str(&json).expect("deserialize task");
        assert_eq!(deserialized.resolution, Some("1920x1080".to_string()));
        assert_eq!(deserialized.thumbnail_url, gallery_item.thumbnail_url);
    }
}
