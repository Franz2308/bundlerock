import { FileCategory } from '../types/download';

export function getFileExtension(filename: string): string {
  if (!filename) return '';
  // Strip query parameters and fragment identifier
  const clean = filename.split('?')[0].split('#')[0].trim();
  const parts = clean.split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function getFileCategory(filename: string): FileCategory {
  const ext = getFileExtension(filename);
  if (!ext) return 'other';

  const videoExts = [
    'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts'
  ];
  if (videoExts.includes(ext)) return 'video';

  const imageExts = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif', 'heic'
  ];
  if (imageExts.includes(ext)) return 'image';

  const audioExts = [
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac'
  ];
  if (audioExts.includes(ext)) return 'audio';

  const docExts = [
    'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv', 'rtf',
    'epub', 'odt', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'
  ];
  if (docExts.includes(ext)) return 'document';

  const programExts = [
    'exe', 'msi', 'iso', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'bin', 'appimage', 'bat', 'sh'
  ];
  if (programExts.includes(ext)) return 'program';

  return 'other';
}

export function formatBytes(bytes?: number | null, decimals = 1): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    if (bytes === 0) return '0 B';
    return '--';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm))} ${sizes[safeIndex]}`;
}

export function formatSpeed(bps?: number | null): string {
  if (!bps || bps <= 0) return '0 B/s';
  return `${formatBytes(bps)}/s`;
}

export function formatETA(
  downloaded: number,
  total?: number | null,
  speedBps?: number
): string {
  if (!total || total <= downloaded || !speedBps || speedBps <= 0) {
    return '--';
  }

  const remainingBytes = total - downloaded;
  const seconds = Math.ceil(remainingBytes / speedBps);

  if (!isFinite(seconds) || seconds <= 0) return '--';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}
