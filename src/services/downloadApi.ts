import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  DownloadProgressPayload,
  DownloadTask,
  ExtractorStatus,
  ProbeResult,
} from '../types/download';

export interface StartDownloadParams {
  url: string;
  savePath?: string;
  destinationPath?: string;
  fileName?: string;
  connections?: number;
  formatId?: string;
  resolution?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export async function probeUrl(url: string): Promise<ProbeResult> {
  return await invoke<ProbeResult>('probe_url', { url });
}

export async function startDownload(params: StartDownloadParams): Promise<DownloadTask> {
  return await invoke<DownloadTask>('start_download', {
    url: params.url,
    savePath: params.savePath || params.destinationPath,
    destinationPath: params.destinationPath || params.savePath,
    fileName: params.fileName,
    connections: params.connections,
    formatId: params.formatId,
    resolution: params.resolution,
    thumbnailUrl: params.thumbnailUrl,
    durationSeconds: params.durationSeconds,
  });
}

export async function checkExtractorStatus(): Promise<ExtractorStatus> {
  return await invoke<ExtractorStatus>('check_extractor_status');
}

export async function installExtractor(): Promise<string> {
  return await invoke<string>('install_extractor');
}

export async function pauseDownload(id: string): Promise<void> {
  await invoke('pause_download', { id });
}

export async function resumeDownload(id: string): Promise<void> {
  await invoke('resume_download', { id });
}

export async function cancelDownload(id: string, deleteFile = false): Promise<void> {
  await invoke('cancel_download', { id, deleteFile });
}

export async function listTasks(): Promise<DownloadTask[]> {
  try {
    return await invoke<DownloadTask[]>('list_downloads');
  } catch {
    return await invoke<DownloadTask[]>('list_tasks');
  }
}

export async function getTask(id: string): Promise<DownloadTask | null> {
  try {
    return await invoke<DownloadTask>('get_download', { id });
  } catch {
    return await invoke<DownloadTask | null>('get_task', { id });
  }
}

export async function getDefaultDirectory(): Promise<string> {
  try {
    return await invoke<string>('get_default_directory');
  } catch {
    return '';
  }
}

export async function openFile(filePath: string): Promise<void> {
  try {
    await openPath(filePath);
  } catch (err) {
    console.error('Failed to open file:', err);
  }
}

export async function openContainingFolder(filePath: string): Promise<void> {
  try {
    await revealItemInDir(filePath);
  } catch (err) {
    console.error('Failed to reveal file:', err);
  }
}

export function onDownloadProgress(
  callback: (payload: DownloadProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgressPayload>('download-progress', (event) => {
    callback(event.payload);
  });
}

export function onDownloadFinished(
  callback: (task: DownloadTask) => void
): Promise<UnlistenFn> {
  return listen<DownloadTask>('download-finished', (event) => {
    callback(event.payload);
  });
}
