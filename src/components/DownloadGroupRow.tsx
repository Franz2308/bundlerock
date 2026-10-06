import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Package,
  File,
  Play,
  Pause,
  FolderOpen,
  X,
  Info,
} from 'lucide-react';
import { DownloadTask, DownloadStatus, FileCategory } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatETA,
  formatDateTime,
  getFileCategory,
} from '../utils/formatters';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';

export interface DownloadGroupItem {
  id: string;
  title: string;
  url: string;
  thumbnail?: string | null;
  tasks: DownloadTask[];
  isMultiFormat: boolean;
  totalBytes: number | null;
  downloadedBytes: number;
  speedBps: number;
  progressPercentage: number;
  status: DownloadStatus;
  createdAt: number;
}

interface DownloadGroupRowProps {
  group: DownloadGroupItem;
  groupIndex: number;
  viewMode?: 'detailed' | 'compact';
  nerdStats?: boolean;
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPauseTask: (id: string) => void;
  onResumeTask: (id: string) => void;
  onCancelTask: (id: string, deleteFile?: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  onInspectTask: (task: DownloadTask) => void;
}

export const DownloadGroupRow: React.FC<DownloadGroupRowProps> = ({
  group,
  groupIndex,
  viewMode = 'detailed',
  nerdStats = false,
  isExpanded,
  onToggleExpand,
  selectedId,
  onSelect,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onOpenFile,
  onOpenFolder,
  onInspectTask,
}) => {
  const { t, language } = useTranslation();
  const [imgError, setImgError] = useState(false);

  const isCompact = viewMode === 'compact';

  // 1. SINGLE DOWNLOAD ROW (Non-grouped)
  if (!group.isMultiFormat) {
    const task = group.tasks[0];
    const category: FileCategory = getFileCategory(task.file_name, task.is_animated_gif);
    const thumbnail = task.thumbnail_url || task.media_thumbnail;
    const isSelected = selectedId === task.id || selectedId === group.id;

    const getCategoryIcon = () => {
      switch (category) {
        case 'video': return <Film className="w-3.5 h-3.5 text-slate-500" />;
        case 'audio': return <Music className="w-3.5 h-3.5 text-slate-500" />;
        case 'image': return <ImageIcon className="w-3.5 h-3.5 text-slate-500" />;
        case 'document': return <FileText className="w-3.5 h-3.5 text-slate-500" />;
        case 'program': return <Package className="w-3.5 h-3.5 text-slate-500" />;
        default: return <File className="w-3.5 h-3.5 text-slate-500" />;
      }
    };

    const getStatusBadge = () => {
      switch (task.status) {
        case 'downloading':
          return (
            <span className="text-blue-700 font-bold flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {t('download.downloading')}
            </span>
          );
        case 'paused':
          return (
            <span className="text-slate-600 font-semibold flex items-center justify-center gap-1">
              <Pause className="w-2.5 h-2.5" /> {t('download.paused')}
            </span>
          );
        case 'completed':
          return <span className="text-emerald-700 font-bold">{t('download.completed')}</span>;
        case 'failed':
          return <span className="text-red-600 font-bold">{t('download.failed')}</span>;
        case 'pending':
          return <span className="text-slate-500 font-semibold">{t('download.pending')}</span>;
        case 'probing':
          return <span className="text-cyan-600 font-semibold">{t('download.probing')}</span>;
        case 'cancelled':
          return <span className="text-slate-400 font-semibold">{t('download.cancelled')}</span>;
        default:
          return <span className="text-slate-500">{t(`download.${task.status}`) || task.status}</span>;
      }
    };

    let domain = '';
    try {
      domain = new URL(task.url).hostname;
    } catch {
      domain = task.url;
    }

    const speedStr = task.status === 'downloading' ? formatSpeed(task.speed_bps) : '0.0 MB/s';
    const etaStr =
      task.status === 'downloading'
        ? formatETA(task.downloaded_bytes, task.total_bytes, task.speed_bps)
        : '--';
    const totalStr = formatBytes(task.total_bytes);
    const downStr = formatBytes(task.downloaded_bytes);

    return (
      <div
        onClick={() => onSelect(task.id)}
        onDoubleClick={() => task.status === 'completed' && onOpenFile(task.file_path)}
        className={cn(
          'download-grid border-b border-slate-200 dark:border-[#202b3d] px-1 text-[11px] transition-colors cursor-pointer select-none',
          isCompact ? 'py-1' : 'py-1.5',
          isSelected
            ? 'bg-[#e3f0fa] dark:bg-[#1b3152] border-[#a6c8ff] dark:border-[#3182ce] -mx-[1px] px-[5px]'
            : 'hover:bg-slate-50 dark:hover:bg-[#182130] bg-white dark:bg-[#131924]'
        )}
      >
        <div className="text-center font-bold text-slate-600 dark:text-slate-400">{groupIndex}</div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-[#1e2738] border border-slate-300 dark:border-[#2f3d54] rounded-sm overflow-hidden">
            {thumbnail && !imgError ? (
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              getCategoryIcon()
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={task.file_name}>
              {task.file_name}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate" title={domain}>
              {downStr} {t('download.of')} {totalStr}
              {nerdStats ? ` • ${task.segments ? task.segments.length : 1} ${t('download.activeThreads')}` : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
          <div className="flex items-center justify-between mb-0.5 text-[10px]">
            <span className="text-slate-600 dark:text-slate-400 font-semibold truncate">{totalStr}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-1">{task.progress_percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-[#1e2738] border border-slate-400 dark:border-[#324057] rounded-none overflow-hidden flex">
            {task.status === 'completed' ? (
              <div className="w-full h-full bg-[#1a365d] dark:bg-[#204070]"></div>
            ) : (
              <div
                className="h-full bg-gradient-to-r from-[#1a365d] to-red-600 dark:from-[#254d85] dark:to-red-500 transition-all duration-200"
                style={{ width: `${task.progress_percentage}%` }}
              ></div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] min-w-0">
          <span className="font-bold text-red-600 dark:text-red-400 truncate">{speedStr}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 ml-1">{etaStr}</span>
        </div>

        <div className="text-center min-w-0 truncate text-[10px] font-mono text-slate-600 dark:text-slate-400" title={formatDateTime(task.completed_at ?? task.created_at, language)}>
          {formatDateTime(task.completed_at ?? task.created_at, language)}
        </div>

        <div className="text-center min-w-0 truncate">{getStatusBadge()}</div>

        <div className="flex items-center justify-center gap-0.5 sm:gap-1 shrink-0">
          {task.status === 'downloading' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.pause')}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {(task.status === 'paused' || task.status === 'failed') && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResumeTask(task.id); }}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-emerald-600 dark:text-emerald-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.resume')}
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {task.status === 'completed' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenFolder(task.file_path); }}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.openFolder')}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInspectTask(task); }}
            className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs transition-colors shrink-0"
            title={t('download.properties')}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancelTask(task.id, false); }}
            className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-rose-600 dark:text-rose-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
            title={t('download.delete')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. MULTI-FORMAT EXPANDABLE TREE GROUP (Windows Explorer Tree Style)
  const completedCount = group.tasks.filter((t) => t.status === 'completed').length;
  const isDownloading = group.tasks.some((t) => t.status === 'downloading');
  const isPaused = group.tasks.some((t) => t.status === 'paused');
  const isGroupSelected = selectedId === group.id;

  let domain = '';
  try {
    domain = new URL(group.url).hostname;
  } catch {
    domain = group.url;
  }

  const speedStr = isDownloading ? formatSpeed(group.speedBps) : '0.0 MB/s';
  const totalStr = formatBytes(group.totalBytes);
  const downStr = formatBytes(group.downloadedBytes);

  const handleGroupPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const t of group.tasks) {
      if (t.status === 'downloading') onPauseTask(t.id);
    }
  };

  const handleGroupResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const t of group.tasks) {
      if (t.status === 'paused' || t.status === 'failed') onResumeTask(t.id);
    }
  };

  const handleGroupOpenFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    const completedTask = group.tasks.find((t) => t.status === 'completed') || group.tasks[0];
    if (completedTask) {
      onOpenFolder(completedTask.file_path);
    }
  };

  const handleGroupDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const t of group.tasks) {
      onCancelTask(t.id, false);
    }
  };

  const handleGroupDoubleClick = () => {
    if (completedCount === group.tasks.length && group.tasks.length > 0) {
      onOpenFolder(group.tasks[0].file_path);
    } else {
      onToggleExpand(group.id);
    }
  };

  return (
    <div className="flex flex-col border-b border-slate-200 dark:border-[#202b3d]">
      {/* 2.1 Parent Tree Node Row */}
      <div
        onClick={() => onSelect(group.id)}
        onDoubleClick={handleGroupDoubleClick}
        className={cn(
          'download-grid px-1 text-[11px] transition-colors cursor-pointer select-none',
          isCompact ? 'py-1.5' : 'py-2',
          isGroupSelected
            ? 'bg-[#e0eef9] dark:bg-[#1b3152] border-l-4 border-l-blue-600'
            : 'bg-slate-50 dark:bg-[#141b27] hover:bg-slate-100/90 dark:hover:bg-[#192231] border-l-4 border-l-slate-400 dark:border-l-slate-600'
        )}
      >
        {/* Tree expander button & Index */}
        <div className="flex items-center justify-center gap-1 font-bold text-slate-700 dark:text-slate-300">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(group.id);
            }}
            className="w-4 h-4 flex items-center justify-center bg-white dark:bg-[#1e2738] hover:bg-blue-50 dark:hover:bg-[#253347] border border-slate-400 dark:border-[#384761] shadow-xs cursor-pointer transition-colors"
            title={isExpanded ? t('download.collapseFormats') : t('download.expandFormats')}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-blue-700 dark:text-blue-400 stroke-[2.5]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate-700 dark:text-slate-300 stroke-[2.5]" />
            )}
          </button>
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{groupIndex}</span>
        </div>

        {/* Group Title, Thumbnail, and Format Count Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-[#1e2738] border border-slate-300 dark:border-[#2f3d54] rounded-sm overflow-hidden">
            {group.thumbnail && !imgError ? (
              <img
                src={group.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <Film className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs" title={group.title}>
                {group.title}
              </span>
              <span className="px-1.5 py-0.2 bg-[#cce8ff] dark:bg-[#1c3558] text-blue-900 dark:text-blue-200 border border-blue-400 dark:border-blue-600 text-[10px] font-bold shrink-0">
                {group.tasks.length} {t('download.formats')}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate" title={domain}>
              {downStr} {t('download.of')} {totalStr} • {domain} • {isExpanded ? t('download.clickToCollapse') : t('download.clickToExpand')}
            </span>
          </div>
        </div>

        {/* Overall Group Progress */}
        <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
          <div className="flex items-center justify-between mb-0.5 text-[10px]">
            <span className="text-slate-600 dark:text-slate-400 font-semibold truncate">{totalStr}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-1">{group.progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-[#1e2738] border border-slate-400 dark:border-[#324057] rounded-none overflow-hidden flex">
            {completedCount === group.tasks.length ? (
              <div className="w-full h-full bg-[#1a365d] dark:bg-[#204070]"></div>
            ) : (
              <div
                className="h-full bg-gradient-to-r from-[#1a365d] to-red-600 dark:from-[#254d85] dark:to-red-500 transition-all duration-200"
                style={{ width: `${group.progressPercentage}%` }}
              ></div>
            )}
          </div>
        </div>

        {/* Combined Speed & Status summary */}
        <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] min-w-0">
          <span className="font-bold text-red-600 dark:text-red-400 truncate">{speedStr}</span>
          <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0 ml-1">
            {completedCount}/{group.tasks.length} {t('download.ready')}
          </span>
        </div>

        {/* Group Date (latest finished format) */}
        <div className="text-center min-w-0 truncate text-[10px] font-mono text-slate-600 dark:text-slate-400" title={formatDateTime(Math.max(...group.tasks.map((t) => t.completed_at ?? 0)) || group.createdAt, language)}>
          {formatDateTime(Math.max(...group.tasks.map((t) => t.completed_at ?? 0)) || group.createdAt, language)}
        </div>

        {/* Group Status */}
        <div className="text-center min-w-0 truncate">
          {isDownloading ? (
            <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              {t('download.downloading')}
            </span>
          ) : completedCount === group.tasks.length ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('download.completed')}</span>
          ) : isPaused ? (
            <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center gap-1">
              <Pause className="w-2.5 h-2.5" /> {t('download.paused')}
            </span>
          ) : group.status === 'failed' ? (
            <span className="text-red-600 dark:text-red-400 font-bold">{t('download.failed')}</span>
          ) : group.status === 'cancelled' ? (
            <span className="text-slate-400 dark:text-slate-500 font-semibold">{t('download.cancelled')}</span>
          ) : group.status === 'probing' ? (
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{t('download.probing')}</span>
          ) : (
            <span className="text-slate-600 dark:text-slate-400 font-semibold">{t('download.pending')}</span>
          )}
        </div>

        {/* Group Actions */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 shrink-0">
          {isDownloading && (
            <button
              type="button"
              onClick={handleGroupPause}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.pauseAll')}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={handleGroupResume}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-emerald-600 dark:text-emerald-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.resumeAll')}
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleGroupOpenFolder}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title={t('download.openDestinationFolder')}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          )}
          {group.tasks[0] && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInspectTask(group.tasks[0]);
              }}
              className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs transition-colors shrink-0"
              title={t('download.properties')}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleGroupDelete}
            className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-rose-600 dark:text-rose-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
            title={t('download.deleteGroup')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2.2 Expanded Tree Children Rows (Windows Explorer Indentation Style) */}
      {isExpanded && (
        <div className="bg-slate-100/70 dark:bg-[#0f1520]/80 border-t border-slate-200 dark:border-[#202b3d] divide-y divide-slate-200/80 dark:divide-[#202b3d]">
          {group.tasks.map((task) => {
            const isTaskSelected = selectedId === task.id;
            const taskSpeedStr =
              task.status === 'downloading' ? formatSpeed(task.speed_bps) : '0.0 MB/s';
            const taskEtaStr =
              task.status === 'downloading'
                ? formatETA(task.downloaded_bytes, task.total_bytes, task.speed_bps)
                : '--';
            const taskTotalStr = formatBytes(task.total_bytes);
            const taskDownStr = formatBytes(task.downloaded_bytes);

            const formatLabel =
              task.resolution ||
              task.media_format ||
              task.file_name.match(/\[(.*?)\]/)?.[1] ||
              task.file_name.split('.').pop() ||
              t('download.formatFallback');

            return (
              <div
                key={task.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(task.id);
                }}
                onDoubleClick={() => task.status === 'completed' && onOpenFile(task.file_path)}
                className={cn(
                  'download-grid px-1 text-[11px] transition-colors cursor-pointer select-none',
                  isCompact ? 'py-1' : 'py-1.5',
                  isTaskSelected
                    ? 'bg-[#e3f0fa] dark:bg-[#1b3152] border-l-4 border-l-blue-500'
                    : 'hover:bg-slate-50 dark:hover:bg-[#182130] bg-white/70 dark:bg-[#121926] border-l-4 border-l-transparent'
                )}
              >
                {/* Indentation Tree Guide */}
                <div className="flex items-center justify-end pr-2">
                  <div className="w-3 h-3 border-l-2 border-b-2 border-slate-400/80 dark:border-slate-600 rounded-bl-sm" />
                </div>

                {/* Format Tag & File Name */}
                <div className="flex items-center gap-2 min-w-0 pl-1">
                  <span className="px-1.5 py-0.2 bg-blue-50 dark:bg-[#192b45] text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-600 text-[10px] font-mono font-bold shrink-0 uppercase">
                    {formatLabel}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={task.file_name}>
                      {task.file_name}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                      {taskDownStr} {t('download.of')} {taskTotalStr}
                      {nerdStats ? ` • ${task.segments ? task.segments.length : 1} ${t('download.threads')}` : ''}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
                  <div className="flex items-center justify-between mb-0.5 text-[10px]">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold truncate">{taskTotalStr}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-1">
                      {task.progress_percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-[#1e2738] border border-slate-400 dark:border-[#324057] rounded-none overflow-hidden flex">
                    {task.status === 'completed' ? (
                      <div className="w-full h-full bg-[#1a365d] dark:bg-[#204070]"></div>
                    ) : (
                      <div
                        className="h-full bg-gradient-to-r from-[#1a365d] to-red-600 dark:from-[#254d85] dark:to-red-500 transition-all duration-200"
                        style={{ width: `${task.progress_percentage}%` }}
                      ></div>
                    )}
                  </div>
                </div>

                {/* Speed / ETA */}
                <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] min-w-0">
                  <span className="font-bold text-red-600 dark:text-red-400 truncate">{taskSpeedStr}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 ml-1">{taskEtaStr}</span>
                </div>

                {/* Date */}
                <div className="text-center min-w-0 truncate text-[10px] font-mono text-slate-600 dark:text-slate-400" title={formatDateTime(task.completed_at ?? task.created_at, language)}>
                  {formatDateTime(task.completed_at ?? task.created_at, language)}
                </div>

                {/* Status */}
                <div className="text-center min-w-0 truncate">
                  {task.status === 'downloading' ? (
                    <span className="text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      {t('download.downloading')}
                    </span>
                  ) : task.status === 'completed' ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('download.completed')}</span>
                  ) : task.status === 'paused' ? (
                    <span className="text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center gap-1">
                      <Pause className="w-2.5 h-2.5" /> {t('download.paused')}
                    </span>
                  ) : task.status === 'pending' ? (
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">{t('download.pending')}</span>
                  ) : task.status === 'cancelled' ? (
                    <span className="text-slate-400 dark:text-slate-500 font-semibold">{t('download.cancelled')}</span>
                  ) : task.status === 'probing' ? (
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{t('download.probing')}</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-bold">{t('download.failed')}</span>
                  )}
                </div>

                {/* Child Individual Actions */}
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 shrink-0">
                  {task.status === 'downloading' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPauseTask(task.id);
                      }}
                      className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
                      title={t('download.pause')}
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(task.status === 'paused' || task.status === 'failed') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResumeTask(task.id);
                      }}
                      className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-emerald-600 dark:text-emerald-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
                      title={t('download.resume')}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFolder(task.file_path);
                      }}
                      className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
                      title={t('download.openFolder')}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectTask(task);
                    }}
                    className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs transition-colors shrink-0"
                    title={t('download.properties')}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelTask(task.id, false);
                    }}
                    className="p-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] text-rose-600 dark:text-rose-400 active:bg-slate-300 dark:active:bg-[#2d3d57] active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
                    title={t('download.deleteThisFormat')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
