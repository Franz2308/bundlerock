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
  Trash2,
  FolderOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { DownloadTask, FileCategory } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatETA,
  getFileCategory,
  formatDuration,
  formatResolutionLabel,
} from '../utils/formatters';
import { SegmentedProgressBar } from './SegmentedProgressBar';
import { cn } from '../utils/cn';

interface DownloadItemProps {
  task: DownloadTask;
  viewMode?: 'detailed' | 'compact';
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string, deleteFile?: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  onInspect: (task: DownloadTask) => void;
}

export const DownloadItem: React.FC<DownloadItemProps> = ({
  task,
  viewMode = 'detailed',
  isSelected = false,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onInspect,
}) => {
  const [copied, setCopied] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState(false);
  const [imgError, setImgError] = useState(false);

  const category: FileCategory = getFileCategory(task.file_name);
  const thumbnail = task.thumbnail_url || task.media_thumbnail;
  const duration = task.duration_seconds ?? task.media_duration;
  const resolution = task.resolution;

  const getCategoryIcon = () => {
    switch (category) {
      case 'video':
        return <Film className="w-5 h-5 text-purple-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-pink-400" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-amber-400" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'program':
        return <Package className="w-5 h-5 text-emerald-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (task.status) {
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
            </span>
            Descargando
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80">
            <Pause className="w-2.5 h-2.5" />
            En Pausa
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Completado
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80">
            <AlertCircle className="w-2.5 h-2.5" />
            Error
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
            {task.status}
          </span>
        );
    }
  };

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(task.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Safe domain extraction
  let domain = '';
  try {
    domain = new URL(task.url).hostname;
  } catch {
    domain = task.url;
  }

  if (viewMode === 'compact') {
    return (
      <div
        onClick={() => onSelect?.(task.id)}
        className={cn(
          'group bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl px-4 py-3 flex items-center gap-4 transition-all duration-200 cursor-pointer',
          isSelected && 'border-cyan-500/70 ring-1 ring-cyan-500/40 bg-slate-900/95 shadow-[0_0_16px_rgba(6,182,212,0.12)]'
        )}
      >
        <div className="shrink-0">
          {thumbnail && !imgError ? (
            <div className="w-10 h-7 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-800/80">
              {getCategoryIcon()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 truncate">
              <span
                className="text-xs font-semibold text-slate-200 truncate cursor-pointer hover:text-cyan-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(task);
                }}
                title={task.file_name}
              >
                {task.file_name}
              </span>
              {task.media_platform && (
                <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-800/50">
                  {task.media_platform}
                </span>
              )}
              {resolution && (
                <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-950/70 text-blue-300 border border-blue-800/50">
                  {formatResolutionLabel(resolution, category === 'image')}
                </span>
              )}
              {duration != null && duration > 0 && (
                <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                  {formatDuration(duration)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {getStatusBadge()}
              <span className="text-[11px] font-mono text-slate-400">
                {task.progress_percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Compact Segmented Progress Bar */}
          <SegmentedProgressBar
            segments={task.segments}
            progressPercentage={task.progress_percentage}
            status={task.status}
            totalBytes={task.total_bytes}
            downloadedBytes={task.downloaded_bytes}
            speedBps={task.speed_bps}
            size="sm"
            showTooltips={false}
          />
        </div>

        {/* Compact stats & actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right text-[11px] font-mono">
            <div className="text-cyan-400 font-semibold">
              {task.status === 'downloading' ? formatSpeed(task.speed_bps) : '--'}
            </div>
            <div className="text-slate-500">
              {formatBytes(task.downloaded_bytes)} / {formatBytes(task.total_bytes)}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {task.status === 'downloading' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPause(task.id);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                title="Pausar"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {(task.status === 'paused' || task.status === 'failed') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(task.id);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                title="Reanudar"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
            {task.status === 'completed' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFile(task.file_path);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Abrir archivo"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel(task.id, false);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detailed Card View (Rich stylized view)
  return (
    <div
      onClick={() => onSelect?.(task.id)}
      className={cn(
        'group bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 transition-all duration-200 shadow-lg shadow-black/20 cursor-pointer',
        task.status === 'downloading' && 'border-cyan-500/30 shadow-[0_4px_24px_rgba(6,182,212,0.06)]',
        isSelected && 'border-cyan-500/70 ring-1 ring-cyan-500/40 bg-slate-900/95 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
      )}
    >
      {/* Top Header: File Info & Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0">
            {thumbnail && !imgError ? (
              <div className="w-16 h-12 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-md">
                <img
                  src={thumbnail}
                  alt={task.file_name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/50 shadow-inner">
                {getCategoryIcon()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect(task);
                }}
                className="text-sm font-bold text-slate-100 truncate hover:text-cyan-300 cursor-pointer transition-colors"
                title={task.file_name}
              >
                {task.file_name}
              </h3>
              {getStatusBadge()}
              {task.media_platform && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/60">
                  {task.media_platform}
                </span>
              )}
              {resolution && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/60 flex items-center gap-1">
                  {category === 'image' ? (
                    <ImageIcon className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Film className="w-3 h-3 text-blue-400" />
                  )}
                  {formatResolutionLabel(resolution, category === 'image')}
                </span>
              )}
              {duration != null && duration > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatDuration(duration)}
                </span>
              )}
            </div>

            {task.stage_message && task.status === 'downloading' && (
              <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1 mt-0.5 animate-pulse">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{task.stage_message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="truncate max-w-[280px]" title={task.url}>
                {domain}
              </span>
              <button
                onClick={copyUrl}
                title="Copiar URL de descarga"
                className="text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              {task.accept_ranges && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                  Multisegmento ({task.num_connections || task.segments?.length || 1}x)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {task.status === 'downloading' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPause(task.id);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Pausar descarga"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar</span>
            </button>
          )}

          {(task.status === 'paused' || task.status === 'failed') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResume(task.id);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reanudar descarga"
            >
              <Play className="w-3.5 h-3.5 fill-cyan-400" />
              <span>Reanudar</span>
            </button>
          )}

          {task.status === 'completed' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFile(task.file_path);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir archivo descargado"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolder(task.file_path);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Mostrar en carpeta"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Delete / Cancel confirmation popup trigger */}
          {showConfirmDelete ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 bg-rose-950/80 border border-rose-800 rounded-lg p-1 text-[11px] animate-in fade-in zoom-in-95"
            >
              <span className="text-rose-200 px-1">¿Eliminar?</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(task.id, false);
                  setShowConfirmDelete(false);
                }}
                className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                Sí
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(false);
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirmDelete(true);
              }}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
              title="Cancelar y eliminar de la lista"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Stylized Segmented Progress Bar */}
      <div className="my-2">
        <SegmentedProgressBar
          segments={task.segments}
          progressPercentage={task.progress_percentage}
          status={task.status}
          totalBytes={task.total_bytes}
          downloadedBytes={task.downloaded_bytes}
          speedBps={task.speed_bps}
          size="md"
          showTooltips={true}
        />
      </div>

      {/* Stats Bottom Row */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 pt-2 border-t border-slate-800/60 text-xs">
        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
          {/* Transfer stats */}
          <div>
            <span className="text-slate-200 font-semibold">
              {formatBytes(task.downloaded_bytes)}
            </span>
            <span className="text-slate-500"> / </span>
            <span>{formatBytes(task.total_bytes)}</span>
          </div>

          {/* Speed Indicator */}
          {task.status === 'downloading' && (
            <div className="flex items-center gap-1 text-cyan-400 font-bold">
              <Zap className="w-3 h-3 fill-cyan-400" />
              <span>{formatSpeed(task.speed_bps)}</span>
            </div>
          )}

          {/* ETA */}
          {task.status === 'downloading' && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>
                ETA:{' '}
                <span className="text-slate-300 font-semibold">
                  {formatETA(task.downloaded_bytes, task.total_bytes, task.speed_bps)}
                </span>
              </span>
            </div>
          )}

          {/* Error Message if failed */}
          {task.status === 'failed' && task.error_message && (
            <div className="text-rose-400 text-xs truncate max-w-sm" title={task.error_message}>
              {task.error_message}
            </div>
          )}
        </div>

        {/* Thread Inspector Toggle */}
        {task.segments && task.segments.length > 0 && (
          <button
            onClick={() => setExpandedThreads(!expandedThreads)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <Cpu className="w-3 h-3" />
            <span>
              {expandedThreads ? 'Ocultar hilos' : `Ver ${task.segments.length} hilos`}
            </span>
            {expandedThreads ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {/* Expandable Multi-Thread Micro Grid */}
      {expandedThreads && task.segments && task.segments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 animate-in fade-in duration-200">
          {task.segments.map((seg) => {
            const segPct =
              seg.total_bytes > 0
                ? Math.min(100, (seg.downloaded_bytes / seg.total_bytes) * 100)
                : seg.status === 'completed'
                ? 100
                : 0;

            return (
              <div
                key={seg.id}
                className="bg-slate-950/70 border border-slate-800 rounded-lg p-1.5 text-[10px] font-mono flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-cyan-400 font-semibold">#{seg.id + 1}</span>
                  <span>{segPct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${segPct}%` }}
                    className={cn(
                      'h-full transition-all duration-200',
                      seg.status === 'completed' || segPct >= 100
                        ? 'bg-emerald-400'
                        : seg.status === 'downloading'
                        ? 'bg-cyan-400'
                        : 'bg-slate-600'
                    )}
                  />
                </div>
                <div className="text-[9px] text-slate-500 mt-1 truncate">
                  {formatBytes(seg.downloaded_bytes)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
