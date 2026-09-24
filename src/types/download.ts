export type DownloadStatus =
  | 'pending'
  | 'probing'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SegmentStatus = 'pending' | 'downloading' | 'completed' | 'failed';

export interface DownloadSegment {
  id: number;
  start_byte: number;
  end_byte: number;
  current_byte: number;
  downloaded_bytes: number;
  total_bytes: number;
  status: SegmentStatus;
}

export interface DownloadTask {
  id: string;
  url: string;
  file_path: string;
  file_name: string;
  total_bytes: number | null;
  downloaded_bytes: number;
  status: DownloadStatus;
  etag: string | null;
  accept_ranges: boolean;
  num_connections: number;
  segments: DownloadSegment[];
  speed_bps: number;
  progress_percentage: number;
  created_at: number;
  updated_at: number;
  error_message: string | null;
}

export interface ProbeResult {
  url: string;
  file_name: string;
  content_length: number | null;
  accept_ranges: boolean;
  etag: string | null;
  content_type: string | null;
  suggested_connections: number;
}

export interface DownloadProgressPayload {
  id: string;
  task_id?: string;
  downloaded_bytes: number;
  total_bytes: number | null;
  speed_bps: number;
  progress_percentage: number;
  progress_percent?: number;
  eta_secs?: number | null;
  status: DownloadStatus;
  segments: DownloadSegment[];
  error_message: string | null;
}

export type FileCategory =
  | 'all'
  | 'video'
  | 'image'
  | 'document'
  | 'audio'
  | 'program'
  | 'other';

export type StatusFilter =
  | 'all'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed';
