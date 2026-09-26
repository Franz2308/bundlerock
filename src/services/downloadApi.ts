import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
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

export async function removeTask(id: string, deleteFile = false): Promise<void> {
  await invoke('remove_task', { id, deleteFile });
}

export async function clearAllTasks(deleteFile = false): Promise<void> {
  await invoke('clear_all_tasks', { deleteFile });
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

export async function minimizeWindow(): Promise<void> {
  try {
    await invoke('minimize_window');
  } catch (err) {
    console.warn('Rust minimize_window failed, falling back to window API:', err);
    await getCurrentWindow().minimize();
  }
}

export async function toggleMaximizeWindow(): Promise<boolean> {
  try {
    return await invoke<boolean>('toggle_maximize_window');
  } catch (err) {
    console.warn('Rust toggle_maximize_window failed, falling back to window API:', err);
    await getCurrentWindow().toggleMaximize();
    return await getCurrentWindow().isMaximized();
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  try {
    return await invoke<boolean>('is_window_maximized');
  } catch {
    return await getCurrentWindow().isMaximized();
  }
}

export async function closeWindow(): Promise<void> {
  try {
    await invoke('close_window');
  } catch (err) {
    console.warn('Rust close_window failed, falling back to window API:', err);
    try {
      await getCurrentWindow().destroy();
    } catch {
      await getCurrentWindow().close();
    }
  }
}

export async function readClipboardText(): Promise<string> {
  try {
    const text = await invoke<string>('get_clipboard_text');
    return text || '';
  } catch (err) {
    console.warn('Rust get_clipboard_text failed, trying plugin API:', err);
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      return (await readText()) || '';
    } catch {
      return '';
    }
  }
}

