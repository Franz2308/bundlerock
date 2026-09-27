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
  ScanLine,
} from 'lucide-react';
import { DownloadTask, DownloadStatus, FileCategory } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatETA,
  getFileCategory,
} from '../utils/formatters';
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
              Descargando
            </span>
          );
        case 'paused':
          return (
            <span className="text-slate-600 font-semibold flex items-center justify-center gap-1">
              <Pause className="w-2.5 h-2.5" /> En Pausa
            </span>
          );
        case 'completed':
          return <span className="text-emerald-700 font-bold">Completado</span>;
        case 'failed':
          return <span className="text-red-600 font-bold">Error</span>;
        default:
          return <span className="text-slate-500">{task.status}</span>;
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
          'grid grid-cols-12 gap-2 items-center border-b border-slate-200 px-1 text-[11px] transition-colors cursor-pointer select-none',
          isCompact ? 'py-1' : 'py-1.5',
          isSelected ? 'bg-[#e3f0fa] border-[#a6c8ff] -mx-[1px] px-[5px]' : 'hover:bg-slate-50 bg-white'
        )}
      >
        <div className="col-span-1 text-center font-bold text-slate-600">{groupIndex}</div>
        <div className="col-span-5 flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-5 h-5 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-sm overflow-hidden">
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
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-800 truncate" title={task.file_name}>
              {task.file_name}
            </span>
            <span className="text-[9px] text-slate-500 truncate" title={domain}>
              {downStr} de {totalStr} • {task.segments ? task.segments.length : 1} hilos activos
            </span>
          </div>
        </div>

        <div className="col-span-2 flex flex-col min-w-0 pr-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-600 font-semibold">{totalStr}</span>
            <span className="font-bold text-slate-800">{task.progress_percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 border border-slate-400 rounded-none overflow-hidden flex">
            {task.status === 'completed' ? (
              <div className="w-full h-full bg-[#1a365d]"></div>
            ) : (
              <div
                className="h-full bg-gradient-to-r from-[#1a365d] to-red-600"
                style={{ width: `${task.progress_percentage}%` }}
              ></div>
            )}
          </div>
        </div>

        <div className="col-span-2 flex items-center justify-between px-2">
          <span className="font-bold text-red-600">{speedStr}</span>
          <span className="font-semibold text-slate-700">{etaStr}</span>
        </div>

        <div className="col-span-1 text-center">{getStatusBadge()}</div>

        <div className="col-span-1 flex items-center justify-center gap-1">
          {task.status === 'downloading' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPauseTask(task.id); }}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Pausar"
            >
              <Pause className="w-3.5 h-3.5 text-slate-700" />
            </button>
          )}
          {(task.status === 'paused' || task.status === 'failed') && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResumeTask(task.id); }}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Reanudar"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          )}
          {task.status === 'completed' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenFolder(task.file_path); }}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Abrir carpeta"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInspectTask(task); }}
            className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
            title="Inspeccionar propiedades y segmentos"
          >
            <ScanLine className="w-3.5 h-3.5 text-blue-700" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancelTask(task.id, false); }}
            className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-rose-600 active:shadow-inner cursor-pointer"
            title="Eliminar"
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
    <div className="flex flex-col border-b border-slate-200">
      {/* 2.1 Parent Tree Node Row */}
      <div
        onClick={() => onSelect(group.id)}
        onDoubleClick={handleGroupDoubleClick}
        className={cn(
          'grid grid-cols-12 gap-2 items-center px-1 text-[11px] transition-colors cursor-pointer select-none',
          isCompact ? 'py-1.5' : 'py-2',
          isGroupSelected
            ? 'bg-[#e0eef9] border-l-4 border-l-blue-600'
            : 'bg-slate-50 hover:bg-slate-100/90 border-l-4 border-l-slate-400'
        )}
      >
        {/* Tree expander button & Index */}
        <div className="col-span-1 flex items-center justify-center gap-1.5 font-bold text-slate-700">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(group.id);
            }}
            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-blue-50 border border-slate-400 shadow-sm cursor-pointer transition-colors"
            title={isExpanded ? 'Contraer formatos' : 'Expandir formatos descargados'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-blue-700 stroke-[2.5]" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-700 stroke-[2.5]" />
            )}
          </button>
          <span className="font-mono text-xs text-slate-600">{groupIndex}</span>
        </div>

        {/* Group Title, Thumbnail, and Format Count Badge */}
        <div className="col-span-5 flex items-center gap-2 min-w-0">
          <div className="shrink-0 w-6 h-6 flex items-center justify-center bg-slate-200 border border-slate-300 rounded-sm overflow-hidden">
            {group.thumbnail && !imgError ? (
              <img
                src={group.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <Film className="w-4 h-4 text-blue-700" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 truncate text-xs" title={group.title}>
                {group.title}
              </span>
              <span className="px-1.5 py-0.2 bg-[#cce8ff] text-blue-900 border border-blue-400 text-[10px] font-bold shrink-0">
                {group.tasks.length} formatos
              </span>
            </div>
            <span className="text-[9px] text-slate-500 truncate" title={domain}>
              {downStr} de {totalStr} • {domain} • Clic para {isExpanded ? 'contraer' : 'expandir'}
            </span>
          </div>
        </div>

        {/* Overall Group Progress */}
        <div className="col-span-2 flex flex-col min-w-0 pr-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-slate-600 font-semibold">{totalStr}</span>
            <span className="font-bold text-slate-800">{group.progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 border border-slate-400 rounded-none overflow-hidden flex">
            {completedCount === group.tasks.length ? (
              <div className="w-full h-full bg-[#1a365d]"></div>
            ) : (
              <div
                className="h-full bg-gradient-to-r from-[#1a365d] to-red-600"
                style={{ width: `${group.progressPercentage}%` }}
              ></div>
            )}
          </div>
        </div>

        {/* Combined Speed & Status summary */}
        <div className="col-span-2 flex items-center justify-between px-2">
          <span className="font-bold text-red-600">{speedStr}</span>
          <span className="text-[10px] font-semibold text-slate-600">
            {completedCount}/{group.tasks.length} listos
          </span>
        </div>

        {/* Group Status */}
        <div className="col-span-1 text-center">
          {isDownloading ? (
            <span className="text-blue-700 font-bold flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Descargando
            </span>
          ) : completedCount === group.tasks.length ? (
            <span className="text-emerald-700 font-bold">Completado</span>
          ) : isPaused ? (
            <span className="text-slate-600 font-semibold flex items-center justify-center gap-1">
              <Pause className="w-2.5 h-2.5" /> En Pausa
            </span>
          ) : group.status === 'failed' ? (
            <span className="text-red-600 font-bold">Error</span>
          ) : (
            <span className="text-slate-600 font-semibold">Pendiente</span>
          )}
        </div>

        {/* Group Actions */}
        <div className="col-span-1 flex items-center justify-center gap-1">
          {isDownloading && (
            <button
              type="button"
              onClick={handleGroupPause}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Pausar todas"
            >
              <Pause className="w-3.5 h-3.5 text-slate-700" />
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={handleGroupResume}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Reanudar todas"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          )}
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleGroupOpenFolder}
              className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
              title="Abrir carpeta de destino"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
            </button>
          )}
          <button
            type="button"
            onClick={handleGroupDelete}
            className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-rose-600 active:shadow-inner cursor-pointer"
            title="Eliminar grupo y sus formatos"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2.2 Expanded Tree Children Rows (Windows Explorer Indentation Style) */}
      {isExpanded && (
        <div className="bg-slate-100/70 border-t border-slate-200 divide-y divide-slate-200/80">
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
              'Formato';

            return (
              <div
                key={task.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(task.id);
                }}
                onDoubleClick={() => task.status === 'completed' && onOpenFile(task.file_path)}
                className={cn(
                  'grid grid-cols-12 gap-2 items-center px-1 text-[11px] transition-colors cursor-pointer select-none',
                  isCompact ? 'py-1' : 'py-1.5',
                  isTaskSelected
                    ? 'bg-[#e3f0fa] border-l-4 border-l-blue-500'
                    : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                )}
              >
                {/* Indentation Tree Guide */}
                <div className="col-span-1 flex items-center justify-end pr-2">
                  <div className="w-3 h-3 border-l-2 border-b-2 border-slate-400/80 rounded-bl-sm" />
                </div>

                {/* Format Tag & File Name */}
                <div className="col-span-5 flex items-center gap-2 min-w-0 pl-1">
                  <span className="px-1.5 py-0.2 bg-blue-50 text-blue-900 border border-blue-300 text-[10px] font-mono font-bold shrink-0 uppercase">
                    {formatLabel}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 truncate" title={task.file_name}>
                      {task.file_name}
                    </span>
                    <span className="text-[9px] text-slate-500 truncate">
                      {taskDownStr} de {taskTotalStr} • {task.segments ? task.segments.length : 1} hilos
                    </span>
                  </div>
                </div>

                {/* Progress */}
                <div className="col-span-2 flex flex-col min-w-0 pr-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-slate-600 font-semibold">{taskTotalStr}</span>
                    <span className="font-bold text-slate-800">
                      {task.progress_percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 border border-slate-400 rounded-none overflow-hidden flex">
                    {task.status === 'completed' ? (
                      <div className="w-full h-full bg-[#1a365d]"></div>
                    ) : (
                      <div
                        className="h-full bg-gradient-to-r from-[#1a365d] to-red-600"
                        style={{ width: `${task.progress_percentage}%` }}
                      ></div>
                    )}
                  </div>
                </div>

                {/* Speed / ETA */}
                <div className="col-span-2 flex items-center justify-between px-2">
                  <span className="font-bold text-red-600">{taskSpeedStr}</span>
                  <span className="font-semibold text-slate-700">{taskEtaStr}</span>
                </div>

                {/* Status */}
                <div className="col-span-1 text-center">
                  {task.status === 'downloading' ? (
                    <span className="text-blue-700 font-bold flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      Descargando
                    </span>
                  ) : task.status === 'completed' ? (
                    <span className="text-emerald-700 font-bold">Completado</span>
                  ) : task.status === 'paused' ? (
                    <span className="text-slate-600 font-semibold flex items-center justify-center gap-1">
                      <Pause className="w-2.5 h-2.5" /> En Pausa
                    </span>
                  ) : (
                    <span className="text-red-600 font-bold">Error</span>
                  )}
                </div>

                {/* Child Individual Actions */}
                <div className="col-span-1 flex items-center justify-center gap-1">
                  {task.status === 'downloading' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPauseTask(task.id);
                      }}
                      className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
                      title="Pausar"
                    >
                      <Pause className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  )}
                  {(task.status === 'paused' || task.status === 'failed') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResumeTask(task.id);
                      }}
                      className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
                      title="Reanudar"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                  )}
                  {task.status === 'completed' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFolder(task.file_path);
                      }}
                      className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
                      title="Abrir carpeta"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectTask(task);
                    }}
                    className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner cursor-pointer"
                    title="Inspeccionar propiedades y segmentos"
                  >
                    <ScanLine className="w-3.5 h-3.5 text-blue-700" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelTask(task.id, false);
                    }}
                    className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-rose-600 active:shadow-inner cursor-pointer"
                    title="Eliminar este formato"
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
