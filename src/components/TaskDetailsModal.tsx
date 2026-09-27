import React, { useState } from 'react';
import {
  X,
  Info,
  ExternalLink,
  FolderOpen,
  Clock,
  Film,
  ImageIcon,
  Sparkles,
  CheckCircle2,
  Pause,
  AlertCircle,
  File,
  Copy,
  Check,
} from 'lucide-react';
import { DownloadTask } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatDuration,
  formatResolutionLabel,
  getFileCategory,
} from '../utils/formatters';

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
  const [copiedField, setCopiedField] = useState<'url' | 'path' | null>(null);

  if (!task) return null;

  const category = getFileCategory(task.file_name, task.is_animated_gif);
  const thumbnail = task.thumbnail_url || task.media_thumbnail;
  const duration = task.duration_seconds ?? task.media_duration;
  const resolution = task.resolution;

  const copyToClipboard = async (text: string, field: 'url' | 'path') => {
    try {
      try {
        const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
        await writeText(text);
      } catch {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getStatusBadge = () => {
    switch (task.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completado
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Descargando
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Pause className="w-3 h-3 text-amber-600" />
            En Pausa
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300 uppercase">
            {task.status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-[1px]">
      <div className="relative w-full max-w-md sm:max-w-lg bg-slate-100 border border-slate-400 shadow-2xl text-slate-800 flex flex-col max-h-[85vh] my-auto">
        {/* Win32 Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 flex items-center justify-between bg-[#1a365d] text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-cyan-300 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wide truncate">
              Propiedades: {task.file_name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 hover:bg-red-600 text-white transition-colors cursor-pointer shrink-0 ml-2"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compressed Scrollable Body */}
        <div className="p-3 space-y-2.5 overflow-y-auto text-xs min-h-0 flex-1 custom-scrollbar">
          {/* File & Media Header Summary Card */}
          <div className="p-2.5 bg-white border border-slate-300 flex items-center gap-2.5">
            {thumbnail && !imgError ? (
              <div className="w-14 h-11 border border-slate-300 bg-slate-100 overflow-hidden shrink-0">
                <img
                  src={thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="w-10 h-10 border border-slate-300 bg-slate-50 flex items-center justify-center shrink-0 text-slate-500">
                {category === 'video' ? (
                  <Film className="w-5 h-5 text-blue-600" />
                ) : category === 'image' ? (
                  <ImageIcon className="w-5 h-5 text-amber-600" />
                ) : (
                  <File className="w-5 h-5 text-slate-500" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 text-xs truncate" title={task.file_name}>
                {task.file_name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {task.media_platform && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-50 text-purple-800 border border-purple-300">
                    {task.media_platform}
                  </span>
                )}
                {(task.is_animated_gif || task.file_name.toLowerCase().endsWith('.gif')) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-50 text-pink-800 border border-pink-300 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-pink-600" />
                    GIF Animado
                  </span>
                )}
                {resolution && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-50 text-blue-800 border border-blue-300 flex items-center gap-1">
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
                    {task.media_format}
                  </span>
                )}
              </div>
              {task.stage_message && (
                <p className="text-[11px] text-amber-700 mt-1 font-medium truncate">
                  {task.stage_message}
                </p>
              )}
            </div>
          </div>

          {/* Properties Sheet Panel */}
          <div className="bg-white border border-slate-300 divide-y divide-slate-200 text-xs">
            {/* Estado */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                Estado
              </span>
              <div className="py-1.5 px-2.5 flex-1 min-w-0 flex items-center justify-between">
                {getStatusBadge()}
                {task.status !== 'completed' && (
                  <span className="font-mono text-slate-700 font-bold text-xs">
                    {task.progress_percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Tamaño */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                Tamaño
              </span>
              <div className="py-1.5 px-2.5 font-mono text-slate-800 flex-1 min-w-0 truncate">
                {task.status === 'completed' ? (
                  <span>{formatBytes(task.total_bytes || task.downloaded_bytes)}</span>
                ) : (
                  <span>{formatBytes(task.downloaded_bytes)} de {formatBytes(task.total_bytes)}</span>
                )}
                {task.total_bytes && task.total_bytes > 0 && (
                  <span className="text-slate-400 text-[11px] ml-1.5">
                    ({task.total_bytes.toLocaleString()} bytes)
                  </span>
                )}
              </div>
            </div>

            {/* Velocidad actual (visible especialmente si está descargando) */}
            {task.status === 'downloading' && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                  Velocidad
                </span>
                <span className="py-1.5 px-2.5 font-mono font-bold text-red-600 flex-1 min-w-0">
                  {formatSpeed(task.speed_bps)}
                </span>
              </div>
            )}

            {/* Conexiones */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                Conexiones
              </span>
              <span className="py-1.5 px-2.5 text-slate-800 flex-1 min-w-0">
                {task.num_connections || (task.segments ? task.segments.length : 1)} multihilo{' '}
                <span className="text-slate-500 font-mono text-[11px]">
                  {task.accept_ranges ? '(Acelerado)' : '(Hilo único)'}
                </span>
              </span>
            </div>

            {/* Ruta en disco */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                Ruta en disco
              </span>
              <div className="py-1 px-2.5 flex-1 min-w-0 flex items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] text-slate-800 truncate select-all" title={task.file_path}>
                  {task.file_path}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(task.file_path, 'path')}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 hover:border-slate-400 border border-slate-300 text-[10px] text-slate-700 font-medium shrink-0 active:bg-slate-300 cursor-pointer flex items-center gap-1 transition-colors"
                  title="Copiar ruta al portapapeles"
                >
                  {copiedField === 'path' ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-slate-500" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* URL de origen */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                URL origen
              </span>
              <div className="py-1 px-2.5 flex-1 min-w-0 flex items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] text-slate-800 truncate select-all" title={task.url}>
                  {task.url}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(task.url, 'url')}
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 hover:border-slate-400 border border-slate-300 text-[10px] text-slate-700 font-medium shrink-0 active:bg-slate-300 cursor-pointer flex items-center gap-1 transition-colors"
                  title="Copiar enlace al portapapeles"
                >
                  {copiedField === 'url' ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-slate-500" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resolución */}
            {resolution && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                  Resolución
                </span>
                <span className="py-1.5 px-2.5 font-mono font-semibold text-slate-800 flex-1 min-w-0">
                  {formatResolutionLabel(resolution, category === 'image')}
                </span>
              </div>
            )}

            {/* Duración */}
            {duration != null && duration > 0 && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                  Duración
                </span>
                <span className="py-1.5 px-2.5 font-mono text-slate-800 flex-1 min-w-0">
                  {formatDuration(duration)}
                </span>
              </div>
            )}

            {/* Fecha */}
            {task.created_at && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 text-slate-600 font-medium border-r border-slate-200">
                  {task.status === 'completed' ? 'Completada' : 'Iniciada'}
                </span>
                <span className="py-1.5 px-2.5 text-slate-700 flex-1 min-w-0 text-[11px] font-mono">
                  {new Date(
                    task.status === 'completed' && task.updated_at
                      ? task.updated_at
                      : task.created_at
                  ).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Active Threads Compact Monitor (Only shown when task is actively downloading) */}
          {task.status === 'downloading' && task.segments && task.segments.length > 0 && (
            <div className="bg-white border border-slate-300 p-2 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center justify-between">
                <span>Hilos activos ({task.segments.length} conexiones)</span>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
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
                      className="bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-mono flex items-center justify-between"
                    >
                      <span className="font-bold text-blue-900 text-[11px]">
                        Hilo #{seg.id + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600">
                          {formatBytes(seg.downloaded_bytes)} / {seg.total_bytes > 0 ? formatBytes(seg.total_bytes) : '--'}
                        </span>
                        <div className="w-16 h-2 bg-slate-200 border border-slate-400 overflow-hidden">
                          <div
                            style={{ width: `${segPct}%` }}
                            className={`h-full ${seg.status === 'completed' ? 'bg-emerald-600' : 'bg-[#1a365d]'}`}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 w-7 text-right">
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

        {/* Win32 Footer Actions */}
        <div className="px-3 py-2 border-t border-slate-300 bg-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {task.status === 'completed' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenFile(task.file_path)}
                  className="px-2.5 sm:px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-800 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner flex items-center gap-1.5 cursor-pointer rounded-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
                  <span>Abrir Archivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFolder(task.file_path)}
                  className="px-2.5 sm:px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-800 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner flex items-center gap-1.5 cursor-pointer rounded-xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
                  <span>Carpeta</span>
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-800 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
