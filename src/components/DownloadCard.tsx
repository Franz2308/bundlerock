import React, { useState } from 'react';
import {
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Package,
  File,
  Play,
  Pause,
  FolderOpen,
  Trash2,
  Layers,
  Info,
} from 'lucide-react';
import { DownloadTask, DownloadStatus, FileCategory } from '../types/download';
import { DownloadGroupItem } from './DownloadGroupRow';
import { formatBytes, formatSpeed, getFileCategory } from '../utils/formatters';
import { cn } from '../utils/cn';

interface DownloadCardProps {
  group: DownloadGroupItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onPauseTask: (id: string) => void;
  onResumeTask: (id: string) => void;
  onCancelTask: (id: string, deleteFile?: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  onInspectTask: (task: DownloadTask) => void;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({
  group,
  isSelected,
  onSelect,
  onPauseTask,
  onResumeTask,
  onCancelTask,
  onOpenFile,
  onOpenFolder,
  onInspectTask,
}) => {
  const [imgError, setImgError] = useState(false);
  const primaryTask = group.tasks[0];
  const isMulti = group.isMultiFormat;

  const category: FileCategory = primaryTask
    ? getFileCategory(primaryTask.file_name, primaryTask.is_animated_gif)
    : 'other';

  const thumbnail = group.thumbnail || primaryTask?.thumbnail_url || primaryTask?.media_thumbnail;

  const getCategoryIcon = () => {
    switch (category) {
      case 'video':
        return <Film className="w-4 h-4 text-blue-600" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'program':
        return <Package className="w-4 h-4 text-red-600" />;
      default:
        return <File className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status: DownloadStatus) => {
    switch (status) {
      case 'downloading':
        return (
          <span className="text-blue-700 font-bold flex items-center gap-1 text-[11px]">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Descargando
          </span>
        );
      case 'paused':
        return (
          <span className="text-slate-600 font-semibold flex items-center gap-1 text-[11px]">
            <Pause className="w-2.5 h-2.5" />
            En Pausa
          </span>
        );
      case 'completed':
        return <span className="text-emerald-700 font-bold text-[11px]">Completado</span>;
      case 'failed':
        return <span className="text-red-600 font-bold text-[11px]">Error</span>;
      default:
        return <span className="text-slate-500 text-[11px]">{status}</span>;
    }
  };

  const handleDoubleClick = () => {
    if (group.status === 'completed') {
      if (primaryTask?.file_path) {
        onOpenFile(primaryTask.file_path);
      } else {
        onOpenFolder('');
      }
    }
  };

  const progressPercent = Math.min(100, Math.max(0, group.progressPercentage || 0));

  return (
    <div
      onClick={() => onSelect(group.id)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'group relative flex flex-col justify-between p-2.5 bg-white border select-none transition-all shadow-2xs hover:shadow-xs',
        isSelected
          ? 'border-blue-500 bg-[#e3f0fa] ring-1 ring-blue-400'
          : 'border-slate-300 hover:border-slate-400'
      )}
    >
      {/* Header: Thumbnail / Icon + Title + Status */}
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xs bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0 overflow-hidden">
          {thumbnail && !imgError ? (
            <img
              src={thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : isMulti ? (
            <Layers className="w-4 h-4 text-blue-700" />
          ) : (
            getCategoryIcon()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span
              className="text-xs font-bold text-slate-800 truncate"
              title={group.title}
            >
              {group.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {getStatusBadge(group.status)}
            {isMulti && (
              <span className="px-1.5 py-0.2 bg-[#cce8ff] text-blue-900 border border-blue-400 text-[10px] font-bold shrink-0">
                {group.tasks.length} formatos
              </span>
            )}
            {!isMulti && primaryTask?.resolution && (
              <span className="px-1.5 py-0.2 bg-blue-50 text-blue-900 border border-blue-300 text-[10px] font-mono font-bold shrink-0 uppercase">
                {primaryTask.resolution}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Progress Bar & Transfer Metrics */}
      <div className="my-2.5">
        <div className="w-full h-2.5 bg-slate-200 border border-slate-400 rounded-none overflow-hidden flex">
          {group.status === 'completed' ? (
            <div className="w-full h-full bg-[#1a365d]"></div>
          ) : group.status === 'paused' ? (
            <div
              className="h-full bg-slate-400"
              style={{ width: `${progressPercent}%` }}
            ></div>
          ) : group.status === 'failed' ? (
            <div
              className="h-full bg-red-600"
              style={{ width: `${progressPercent}%` }}
            ></div>
          ) : (
            <div
              className="h-full bg-gradient-to-r from-[#1a365d] to-red-600 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            ></div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1">
          <span className="font-semibold text-slate-600 truncate font-mono">
            {group.status === 'completed'
              ? formatBytes(group.totalBytes || group.downloadedBytes)
              : `${formatBytes(group.downloadedBytes)} / ${formatBytes(group.totalBytes)}`}
          </span>
          <span className="font-bold text-red-600 font-mono">
            {group.status === 'downloading'
              ? formatSpeed(group.speedBps)
              : `${progressPercent.toFixed(0)}%`}
          </span>
        </div>
      </div>

      {/* Footer: Quick Action Buttons */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-xs">
        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
          {isMulti
            ? group.tasks.map((t) => t.resolution || t.media_format || 'Auto').join(', ')
            : primaryTask?.file_name}
        </span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {group.status === 'downloading' && (
            <button
              type="button"
              onClick={() => onPauseTask(primaryTask?.id || group.id)}
              className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title="Pausar"
            >
              <Pause className="w-3 h-3" />
            </button>
          )}

          {group.status === 'paused' && (
            <button
              type="button"
              onClick={() => onResumeTask(primaryTask?.id || group.id)}
              className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-emerald-600 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title="Reanudar"
            >
              <Play className="w-3 h-3" />
            </button>
          )}

          {primaryTask?.file_path && group.status === 'completed' && (
            <button
              type="button"
              onClick={() => onOpenFolder(primaryTask.file_path)}
              className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title="Abrir carpeta contenedora"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
          )}

          {primaryTask && (
            <button
              type="button"
              onClick={() => onInspectTask(primaryTask)}
              className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 hover:text-blue-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
              title="Propiedades y detalles"
            >
              <Info className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onCancelTask(primaryTask?.id || group.id, false)}
            className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 hover:text-red-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors"
            title="Eliminar de la lista"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
