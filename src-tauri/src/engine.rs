use crate::models::{DownloadSegment, SegmentStatus};
use crate::storage::StorageFile;
use futures_util::StreamExt;
use reqwest::header;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, watch};

const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BundleRock/0.1.0";

#[derive(Debug, Clone)]
pub struct SegmentProgressUpdate {
    pub segment_id: usize,
    pub bytes_written: u64,
    pub current_byte: u64,
    pub status: SegmentStatus,
    pub error: Option<String>,
}

/// Divides the total byte range into non-overlapping contiguous segments.
pub fn divide_ranges(total_bytes: u64, num_connections: usize) -> Vec<DownloadSegment> {
    if total_bytes == 0 {
        return vec![DownloadSegment::new(0, 0, 0)];
    }

    let num_connections = (num_connections as u64).clamp(1, total_bytes) as usize;
    let chunk_size = total_bytes / (num_connections as u64);
    let mut segments = Vec::with_capacity(num_connections);

    for i in 0..num_connections {
        let start_byte = (i as u64) * chunk_size;
        let end_byte = if i == num_connections - 1 {
            total_bytes - 1
        } else {
            ((i as u64) + 1) * chunk_size - 1
        };

        segments.push(DownloadSegment::new(i, start_byte, end_byte));
    }

    segments
}

/// Spawns a Tokio task to download a single segment with HTTP Range.
pub async fn download_segment_worker(
    client: reqwest::Client,
    url: String,
    segment: DownloadSegment,
    etag: Option<String>,
    storage: Arc<StorageFile>,
    progress_tx: mpsc::Sender<SegmentProgressUpdate>,
    mut cancel_rx: watch::Receiver<bool>,
) {
    let segment_id = segment.id;
    let mut current_byte = segment.current_byte;
    let end_byte = segment.end_byte;

    // If segment already finished (e.g. resumed), mark completed and exit
    if current_byte > end_byte {
        let _ = progress_tx
            .send(SegmentProgressUpdate {
                segment_id,
                bytes_written: 0,
                current_byte,
                status: SegmentStatus::Completed,
                error: None,
            })
            .await;
        return;
    }

    // Notify downloading started
    let _ = progress_tx
        .send(SegmentProgressUpdate {
            segment_id,
            bytes_written: 0,
            current_byte,
            status: SegmentStatus::Downloading,
            error: None,
        })
        .await;

    let range_header = format!("bytes={current_byte}-{end_byte}");
    let mut request = client
        .get(&url)
        .header(header::USER_AGENT, DEFAULT_USER_AGENT)
        .header(header::RANGE, &range_header)
        .timeout(Duration::from_secs(30));

    if let Some(ref tag) = etag {
        request = request.header(header::IF_RANGE, tag);
    }

    let response = match request.send().await {
        Ok(resp) => {
            let status = resp.status();
            // Multi-segment downloads strictly require 206 Partial Content
            if status != reqwest::StatusCode::PARTIAL_CONTENT {
                let _ = progress_tx
                    .send(SegmentProgressUpdate {
                        segment_id,
                        bytes_written: 0,
                        current_byte,
                        status: SegmentStatus::Failed,
                        error: Some(format!(
                            "Server does not support range requests (returned HTTP {status})"
                        )),
                    })
                    .await;
                return;
            }
            resp
        }
        Err(e) => {
            let _ = progress_tx
                .send(SegmentProgressUpdate {
                    segment_id,
                    bytes_written: 0,
                    current_byte,
                    status: SegmentStatus::Failed,
                    error: Some(format!("Connection error: {e}")),
                })
                .await;
            return;
        }
    };

    let mut stream = response.bytes_stream();

    loop {
        // Check for cancellation/pause signal before each select
        if *cancel_rx.borrow() {
            let _ = progress_tx
                .send(SegmentProgressUpdate {
                    segment_id,
                    bytes_written: 0,
                    current_byte,
                    status: SegmentStatus::Pending,
                    error: None,
                })
                .await;
            return;
        }

        tokio::select! {
            change_res = cancel_rx.changed() => {
                // If channel closed (Err) or signal is true, stop worker without busy-loop
                if change_res.is_err() || *cancel_rx.borrow() {
                    let _ = progress_tx
                        .send(SegmentProgressUpdate {
                            segment_id,
                            bytes_written: 0,
                            current_byte,
                            status: SegmentStatus::Pending,
                            error: None,
                        })
                        .await;
                    return;
                }
            }
            chunk_result = stream.next() => {
                match chunk_result {
                    Some(Ok(chunk)) => {
                        let chunk_len = chunk.len() as u64;
                        // Avoid writing beyond segment end_byte
                        let max_allowed = (end_byte + 1).saturating_sub(current_byte);
                        let write_len = chunk_len.min(max_allowed);

                        if write_len > 0 {
                            if let Err(e) = storage.write_at(current_byte, &chunk[..write_len as usize]) {
                                let _ = progress_tx
                                    .send(SegmentProgressUpdate {
                                        segment_id,
                                        bytes_written: 0,
                                        current_byte,
                                        status: SegmentStatus::Failed,
                                        error: Some(format!("Disk write error: {e}")),
                                    })
                                    .await;
                                return;
                            }

                            current_byte += write_len;

                            let is_completed = current_byte > end_byte;
                            let status = if is_completed {
                                SegmentStatus::Completed
                            } else {
                                SegmentStatus::Downloading
                            };

                            let _ = progress_tx
                                .send(SegmentProgressUpdate {
                                    segment_id,
                                    bytes_written: write_len,
                                    current_byte,
                                    status,
                                    error: None,
                                })
                                .await;

                            if is_completed {
                                return;
                            }
                        }
                    }
                    Some(Err(e)) => {
                        let _ = progress_tx
                            .send(SegmentProgressUpdate {
                                segment_id,
                                bytes_written: 0,
                                current_byte,
                                status: SegmentStatus::Failed,
                                error: Some(format!("Stream error: {e}")),
                            })
                            .await;
                        return;
                    }
                    None => {
                        // Stream ended at EOF
                        let is_completed = current_byte > end_byte;
                        let status = if is_completed {
                            SegmentStatus::Completed
                        } else {
                            SegmentStatus::Failed
                        };
                        let error = if is_completed {
                            None
                        } else {
                            Some("Stream ended prematurely before segment boundary".to_string())
                        };

                        let _ = progress_tx
                            .send(SegmentProgressUpdate {
                                segment_id,
                                bytes_written: 0,
                                current_byte,
                                status,
                                error,
                            })
                            .await;
                        return;
                    }
                }
            }
        }
    }
}

/// Downloads a single-stream file when Range requests are not supported or total size is unknown.
pub async fn download_single_stream_worker(
    client: reqwest::Client,
    url: String,
    etag: Option<String>,
    storage: Arc<StorageFile>,
    progress_tx: mpsc::Sender<SegmentProgressUpdate>,
    mut cancel_rx: watch::Receiver<bool>,
    mut current_byte: u64,
) {
    let segment_id = 0;

    let mut request_builder = client
        .get(&url)
        .header(header::USER_AGENT, DEFAULT_USER_AGENT)
        .timeout(Duration::from_secs(30));

    if let Some(ref tag) = etag {
        request_builder = request_builder.header(header::IF_RANGE, tag);
    }

    // If resuming an already started single stream, try Range header if server might support it
    if current_byte > 0 {
        request_builder = request_builder.header(header::RANGE, format!("bytes={current_byte}-"));
    }

    let response = match request_builder.send().await {
        Ok(resp) => {
            let status = resp.status();
            if !status.is_success() {
                let _ = progress_tx
                    .send(SegmentProgressUpdate {
                        segment_id,
                        bytes_written: 0,
                        current_byte,
                        status: SegmentStatus::Failed,
                        error: Some(format!("HTTP error: {status}")),
                    })
                    .await;
                return;
            }

            // If we asked for Range from current_byte > 0 but server returned 200 OK:
            // the server ignored Range and is sending the file from byte 0.
            // Reset current_byte to 0 and truncate storage file to prevent corruption!
            if current_byte > 0 && status == reqwest::StatusCode::OK {
                current_byte = 0;
                let _ = storage.truncate(0);
                let _ = progress_tx
                    .send(SegmentProgressUpdate {
                        segment_id,
                        bytes_written: 0,
                        current_byte: 0,
                        status: SegmentStatus::Downloading,
                        error: None,
                    })
                    .await;
            }

            resp
        }
        Err(e) => {
            let _ = progress_tx
                .send(SegmentProgressUpdate {
                    segment_id,
                    bytes_written: 0,
                    current_byte,
                    status: SegmentStatus::Failed,
                    error: Some(format!("Request error: {e}")),
                })
                .await;
            return;
        }
    };

    let mut stream = response.bytes_stream();

    loop {
        if *cancel_rx.borrow() {
            let _ = progress_tx
                .send(SegmentProgressUpdate {
                    segment_id,
                    bytes_written: 0,
                    current_byte,
                    status: SegmentStatus::Pending,
                    error: None,
                })
                .await;
            return;
        }

        tokio::select! {
            change_res = cancel_rx.changed() => {
                if change_res.is_err() || *cancel_rx.borrow() {
                    let _ = progress_tx
                        .send(SegmentProgressUpdate {
                            segment_id,
                            bytes_written: 0,
                            current_byte,
                            status: SegmentStatus::Pending,
                            error: None,
                        })
                        .await;
                    return;
                }
            }
            chunk_result = stream.next() => {
                match chunk_result {
                    Some(Ok(chunk)) => {
                        let chunk_len = chunk.len() as u64;
                        if let Err(e) = storage.write_at(current_byte, &chunk) {
                            let _ = progress_tx
                                .send(SegmentProgressUpdate {
                                    segment_id,
                                    bytes_written: 0,
                                    current_byte,
                                    status: SegmentStatus::Failed,
                                    error: Some(format!("Disk write error: {e}")),
                                })
                                .await;
                            return;
                        }

                        current_byte += chunk_len;
                        let _ = progress_tx
                            .send(SegmentProgressUpdate {
                                segment_id,
                                bytes_written: chunk_len,
                                current_byte,
                                status: SegmentStatus::Downloading,
                                error: None,
                            })
                            .await;
                    }
                    Some(Err(e)) => {
                        let _ = progress_tx
                            .send(SegmentProgressUpdate {
                                segment_id,
                                bytes_written: 0,
                                current_byte,
                                status: SegmentStatus::Failed,
                                error: Some(format!("Stream error: {e}")),
                            })
                            .await;
                        return;
                    }
                    None => {
                        // Stream ended at EOF -> Completed
                        let _ = progress_tx
                            .send(SegmentProgressUpdate {
                                segment_id,
                                bytes_written: 0,
                                current_byte,
                                status: SegmentStatus::Completed,
                                error: None,
                            })
                            .await;
                        return;
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_divide_ranges_exact() {
        let total = 1000;
        let num_connections = 4;
        let segments = divide_ranges(total, num_connections);

        assert_eq!(segments.len(), 4);
        assert_eq!(segments[0].start_byte, 0);
        assert_eq!(segments[0].end_byte, 249);
        assert_eq!(segments[0].total_bytes, 250);

        assert_eq!(segments[1].start_byte, 250);
        assert_eq!(segments[1].end_byte, 499);
        assert_eq!(segments[1].total_bytes, 250);

        assert_eq!(segments[2].start_byte, 500);
        assert_eq!(segments[2].end_byte, 749);
        assert_eq!(segments[2].total_bytes, 250);

        assert_eq!(segments[3].start_byte, 750);
        assert_eq!(segments[3].end_byte, 999);
        assert_eq!(segments[3].total_bytes, 250);

        let sum: u64 = segments.iter().map(|s| s.total_bytes).sum();
        assert_eq!(sum, total);
    }

    #[test]
    fn test_divide_ranges_non_divisible() {
        let total = 100;
        let num_connections = 3;
        let segments = divide_ranges(total, num_connections);

        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].start_byte, 0);
        assert_eq!(segments[0].end_byte, 32); // 33 bytes
        assert_eq!(segments[1].start_byte, 33);
        assert_eq!(segments[1].end_byte, 65); // 33 bytes
        assert_eq!(segments[2].start_byte, 66);
        assert_eq!(segments[2].end_byte, 99); // 34 bytes

        let sum: u64 = segments.iter().map(|s| s.total_bytes).sum();
        assert_eq!(sum, total);
    }

    #[test]
    fn test_divide_ranges_single_byte() {
        let total = 1;
        let num_connections = 8;
        let segments = divide_ranges(total, num_connections);

        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].start_byte, 0);
        assert_eq!(segments[0].end_byte, 0);
        assert_eq!(segments[0].total_bytes, 1);
    }

    #[test]
    fn test_divide_ranges_zero_byte() {
        let total = 0;
        let num_connections = 4;
        let segments = divide_ranges(total, num_connections);
        assert_eq!(segments.len(), 1);
    }
}
