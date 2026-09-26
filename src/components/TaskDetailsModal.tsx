import React, { useState } from 'react';
import {
  X,
  Cpu,
  ExternalLink,
  FolderOpen,
  Clock,
  Film,
  ImageIcon,
  Sparkles,
} from 'lucide-react';
import { DownloadTask } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatDuration,
  formatResolutionLabel,
  getFileCategory,
} from '../utils/formatters';
import { SegmentedProgressBar } from './SegmentedProgressBar';
import { cn } from '../utils/cn';

interface TaskDetailsModalProps {
  task: DownloadTask | null;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  onClose,
  onOpenFile,
  onOpenFolder,
}) => {
  const [imgError, setImgError] = useState(false);
  if (!task) return null;

  const category = getFileCategory(task.file_name, task.is_animated_gif);
  const thumbnail = task.thumbnail_url || task.media_thumbnail;
  const duration = task.duration_seconds ?? task.media_duration;
  const resolution = task.resolution;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
      <div className="relative w-full max-w-2xl bg-slate-100 border border-slate-400 shadow-2xl text-slate-800 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 flex items-center justify-between bg-[#1a365d] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-300" />
            <h2 className="text-xs font-bold uppercase tracking-wide truncate max-w-md">
              Propiedades / Segmentos: {task.file_name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-red-600 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto text-xs">
          {/* Media Header Preview */}
          {(task.is_media || thumbnail || resolution || duration) && (
            <div className="p-2.5 bg-white border border-slate-300 flex items-center gap-3">
              {thumbnail && !imgError ? (
                <div className="w-20 h-14 border border-slate-300 bg-slate-100 overflow-hidden shrink-0">
                  <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {task.media_platform && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-100 text-purple-800 border border-purple-300">
                      {task.media_platform}
                    </span>
                  )}
                  {(task.is_animated_gif || task.file_name.toLowerCase().endsWith('.gif')) && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-100 text-pink-800 border border-pink-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-pink-600" />
                      GIF Animado
                    </span>
                  )}
                  {resolution && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                      {category === 'image' ? (
                        <ImageIcon className="w-2.5 h-2.5 text-blue-600" />
                      ) : (
                        <Film className="w-2.5 h-2.5 text-blue-600" />
                      )}
                      {formatResolutionLabel(resolution, category === 'image')}
                    </span>
                  )}
                  {duration != null && duration > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                      {formatDuration(duration)}
                    </span>
                  )}
                  {task.media_format && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-800 border border-slate-300">
                      Formato: {task.media_format}
                    </span>
                  )}
                </div>
                {task.stage_message && (
                  <p className="text-xs text-amber-700 mt-1 font-semibold">
                    {task.stage_message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Main Visual Progress */}
          <div className="bg-white border border-slate-300 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold">Progreso de la Tarea:</span>
              <span className="font-mono font-bold text-slate-900">
                {task.progress_percentage.toFixed(2)}%
              </span>
            </div>
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

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white border border-slate-300 p-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Velocidad actual</div>
              <div className="text-xs font-mono font-bold text-red-600 mt-0.5">
                {formatSpeed(task.speed_bps)}
              </div>
            </div>
            <div className="bg-white border border-slate-300 p-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Descargado</div>
              <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                {formatBytes(task.downloaded_bytes)}
              </div>
            </div>
            <div className="bg-white border border-slate-300 p-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Tamaño Total</div>
              <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">
                {formatBytes(task.total_bytes)}
              </div>
            </div>
            <div className="bg-white border border-slate-300 p-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Estado</div>
              <div className="text-xs font-bold text-blue-900 mt-0.5 uppercase">
                {task.status}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-white border border-slate-300 p-2.5 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2 pb-1 border-b border-slate-200">
              <span className="text-slate-500 shrink-0 font-medium">URL:</span>
              <span className="font-mono text-slate-800 truncate select-all text-right" title={task.url}>
                {task.url}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 pb-1 border-b border-slate-200">
              <span className="text-slate-500 shrink-0 font-medium">Ruta en disco:</span>
              <span className="font-mono text-slate-800 truncate select-all text-right" title={task.file_path}>
                {task.file_path}
              </span>
            </div>
            {resolution && (
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Resolución:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {formatResolutionLabel(resolution, category === 'image')}
                </span>
              </div>
            )}
            {duration != null && duration > 0 && (
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Duración:</span>
                <span className="font-mono text-slate-800">
                  {formatDuration(duration)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Acepta Rangos:</span>
              <span className="font-mono text-slate-800 font-semibold">
                {task.accept_ranges ? 'Sí (Acelerado multihilo)' : 'No (Hilo único)'}
              </span>
            </div>
          </div>

          {/* Thread / Segment Detailed List */}
          {task.segments && task.segments.length > 0 && (
            <div className="bg-white border border-slate-300 p-2.5">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center justify-between">
                <span>Segmentos de Descarga ({task.segments.length} conexiones)</span>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
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
                      className="bg-slate-50 border border-slate-300 p-1.5 text-xs font-mono flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-900">
                          Hilo #{seg.id + 1}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {formatBytes(seg.downloaded_bytes)} / {seg.total_bytes > 0 ? formatBytes(seg.total_bytes) : '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 border border-slate-400 overflow-hidden">
                          <div
                            style={{ width: `${segPct}%` }}
                            className={cn(
                              'h-full',
                              seg.status === 'completed' ? 'bg-emerald-600' : 'bg-blue-600'
                            )}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 w-8 text-right">
                          {segPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-3 py-2 border-t border-slate-300 bg-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {task.status === 'completed' && (
              <>
                <button
                  onClick={() => onOpenFile(task.file_path)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:bg-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span>Abrir Archivo</span>
                </button>
                <button
                  onClick={() => onOpenFolder(task.file_path)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:bg-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
                  <span>Carpeta</span>
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:bg-slate-300 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
