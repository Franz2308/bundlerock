export type DownloadStatus =
  | 'pending'
  | 'probing'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SegmentStatus = 'pending' | 'downloading' | 'completed' | 'failed';

export type SocialMediaPlatform =
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'other';

export interface MediaGalleryItem {
  url: string;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  index: number;
}

export interface MediaFormatOption {
  format_id: string;
  quality_label: string;
  ext: string;
  resolution?: string | null;
  filesize_approx?: number | null;
  is_audio_only: boolean;
  format_note?: string | null;
}

export interface MediaMetadata {
  title: string;
  uploader?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  platform: SocialMediaPlatform;
  platform_level: number;
  platform_display: string;
  formats: MediaFormatOption[];
  gallery_items?: MediaGalleryItem[];
}

export interface ExtractorStatus {
  ytdlp_installed: boolean;
  ytdlp_path: string | null;
  ffmpeg_installed: boolean;
  ffmpeg_path: string | null;
}

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
  is_media?: boolean;
  media_thumbnail?: string | null;
  thumbnail_url?: string | null;
  media_duration?: number | null;
  duration_seconds?: number | null;
  media_platform?: string | null;
  media_format?: string | null;
  resolution?: string | null;
  stage_message?: string | null;
}

export interface ProbeResult {
  url: string;
  file_name: string;
  content_length: number | null;
  accept_ranges: boolean;
  etag: string | null;
  content_type: string | null;
  suggested_connections: number;
  media_info?: MediaMetadata | null;
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
  is_media?: boolean;
  media_thumbnail?: string | null;
  thumbnail_url?: string | null;
  media_duration?: number | null;
  duration_seconds?: number | null;
  resolution?: string | null;
  stage_message?: string | null;
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
