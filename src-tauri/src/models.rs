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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bps: u64,
    pub progress_percentage: f64,
    pub status: DownloadStatus,
    pub segments: Vec<DownloadSegment>,
    pub error_message: Option<String>,
}

impl From<&DownloadTask> for DownloadProgressPayload {
    fn from(task: &DownloadTask) -> Self {
        Self {
            id: task.id.clone(),
            downloaded_bytes: task.downloaded_bytes,
            total_bytes: task.total_bytes,
            speed_bps: task.speed_bps,
            progress_percentage: task.progress_percentage,
            status: task.status,
            segments: task.segments.clone(),
            error_message: task.error_message.clone(),
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
}
