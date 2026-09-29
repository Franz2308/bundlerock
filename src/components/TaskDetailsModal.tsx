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
import { useTranslation } from '../i18n';

interface TaskDetailsModalProps {
  task: DownloadTask | null;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  nerdStats?: boolean;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  onClose,
  onOpenFile,
  onOpenFolder,
  nerdStats = false,
}) => {
  const { t, language } = useTranslation();
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
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {t('download.completed')}
          </span>
        );
      case 'downloading':
        return (
          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
            {t('download.downloading')}
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
            <Pause className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {t('download.paused')}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            {t('download.failed')}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {t('download.pending')}
          </span>
        );
      case 'probing':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
            {t('download.probing')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            {t('download.cancelled')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase">
            {t(`download.${task.status}`) || task.status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-md sm:max-w-lg bg-slate-100 dark:bg-[#141b27] border border-slate-400 dark:border-[#2d3a4f] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col max-h-[85vh] my-auto">
        {/* Win32 Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 dark:border-[#202b3d] flex items-center justify-between bg-[#1a365d] dark:bg-[#12233c] text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-cyan-300 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wide truncate">
              {t('taskDetails.titlePrefix', { name: task.file_name })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 hover:bg-red-600 text-white transition-colors cursor-pointer shrink-0 ml-2"
            title={t('taskDetails.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compressed Scrollable Body */}
        <div className="p-3 space-y-2.5 overflow-y-auto text-xs min-h-0 flex-1 custom-scrollbar">
          {/* File & Media Header Summary Card */}
          <div className="p-2.5 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] flex items-center gap-2.5">
            {thumbnail && !imgError ? (
              <div className="w-14 h-11 border border-slate-300 dark:border-[#2a3649] bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                <img
                  src={thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="w-10 h-10 border border-slate-300 dark:border-[#2a3649] bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center shrink-0 text-slate-500">
                {category === 'video' ? (
                  <Film className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : category === 'image' ? (
                  <ImageIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <File className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs truncate" title={task.file_name}>
                {task.file_name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {task.media_platform && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50">
                    {task.media_platform}
                  </span>
                )}
                {(task.is_animated_gif || task.file_name.toLowerCase().endsWith('.gif')) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-700/50 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-pink-600 dark:text-pink-400" />
                    {t('taskDetails.animatedGif')}
                  </span>
                )}
                {resolution && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50 flex items-center gap-1">
                    {category === 'image' ? (
                      <ImageIcon className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Film className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                    )}
                    {formatResolutionLabel(resolution, category === 'image')}
                  </span>
                )}
                {duration != null && duration > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-slate-500" />
                    {formatDuration(duration)}
                  </span>
                )}
                {task.media_format && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                    {task.media_format}
                  </span>
                )}
              </div>
              {task.stage_message && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium truncate">
                  {task.stage_message}
                </p>
              )}
            </div>
          </div>

          {/* Properties Sheet Panel */}
          <div className="bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] divide-y divide-slate-200 dark:divide-[#232f42] text-xs">
            {/* Estado */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                {t('taskDetails.status')}
              </span>
              <div className="py-1.5 px-2.5 flex-1 min-w-0 flex items-center justify-between">
                {getStatusBadge()}
                {task.status !== 'completed' && (
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold text-xs">
                    {task.progress_percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Tamaño */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                {t('taskDetails.size')}
              </span>
              <div className="py-1.5 px-2.5 font-mono text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">
                {task.status === 'completed' ? (
                  <span>{formatBytes(task.total_bytes || task.downloaded_bytes)}</span>
                ) : (
                  <span>{formatBytes(task.downloaded_bytes)} {t('taskDetails.of')} {formatBytes(task.total_bytes)}</span>
                )}
                {task.total_bytes && task.total_bytes > 0 && (
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-1.5">
                    ({task.total_bytes.toLocaleString(language === 'es' ? 'es-ES' : 'en-US')} {t('taskDetails.bytes')})
                  </span>
                )}
              </div>
            </div>

            {/* Velocidad actual */}
            {task.status === 'downloading' && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                  {t('taskDetails.speed')}
                </span>
                <span className="py-1.5 px-2.5 font-mono font-bold text-red-600 dark:text-red-400 flex-1 min-w-0">
                  {formatSpeed(task.speed_bps)}
                </span>
              </div>
            )}

            {/* Conexiones */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                {t('taskDetails.connections')}
              </span>
              <span className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200 flex-1 min-w-0">
                {task.num_connections || (task.segments ? task.segments.length : 1)} {t('taskDetails.multithread')}{' '}
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {task.accept_ranges ? t('taskDetails.accelerated') : t('taskDetails.singleThread')}
                </span>
              </span>
            </div>

            {/* Ruta en disco */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                {t('taskDetails.diskPath')}
              </span>
              <div className="py-1 px-2.5 flex-1 min-w-0 flex items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate select-all" title={task.file_path}>
                  {task.file_path}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(task.file_path, 'path')}
                  className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#1f293a] hover:bg-slate-200 dark:hover:bg-[#2b374d] hover:border-slate-400 dark:hover:border-slate-500 border border-slate-300 dark:border-[#384761] text-[10px] text-slate-700 dark:text-slate-300 font-medium shrink-0 active:bg-slate-300 dark:active:bg-slate-700 cursor-pointer flex items-center gap-1 transition-colors"
                  title={t('taskDetails.copyPath')}
                >
                  {copiedField === 'path' ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('taskDetails.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                      <span>{t('taskDetails.copy')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* URL de origen */}
            <div className="flex items-center">
              <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                {t('taskDetails.sourceUrl')}
              </span>
              <div className="py-1 px-2.5 flex-1 min-w-0 flex items-center justify-between gap-1.5">
                <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate select-all" title={task.url}>
                  {task.url}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(task.url, 'url')}
                  className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#1f293a] hover:bg-slate-200 dark:hover:bg-[#2b374d] hover:border-slate-400 dark:hover:border-slate-500 border border-slate-300 dark:border-[#384761] text-[10px] text-slate-700 dark:text-slate-300 font-medium shrink-0 active:bg-slate-300 dark:active:bg-slate-700 cursor-pointer flex items-center gap-1 transition-colors"
                  title={t('taskDetails.copyUrl')}
                >
                  {copiedField === 'url' ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('taskDetails.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                      <span>{t('taskDetails.copy')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resolución */}
            {resolution && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                  {t('taskDetails.resolution')}
                </span>
                <span className="py-1.5 px-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200 flex-1 min-w-0">
                  {formatResolutionLabel(resolution, category === 'image')}
                </span>
              </div>
            )}

            {/* Duración */}
            {duration != null && duration > 0 && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                  {t('taskDetails.duration')}
                </span>
                <span className="py-1.5 px-2.5 font-mono text-slate-800 dark:text-slate-200 flex-1 min-w-0">
                  {formatDuration(duration)}
                </span>
              </div>
            )}

            {/* Fecha */}
            {task.created_at && (
              <div className="flex items-center">
                <span className="w-28 sm:w-32 shrink-0 py-1.5 px-2.5 bg-slate-50 dark:bg-[#111722] text-slate-600 dark:text-slate-300 font-medium border-r border-slate-200 dark:border-[#232f42]">
                  {task.status === 'completed' ? t('taskDetails.completedAt') : t('taskDetails.startedAt')}
                </span>
                <span className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 flex-1 min-w-0 text-[11px] font-mono">
                  {new Date(
                    task.status === 'completed' && task.updated_at
                      ? task.updated_at
                      : task.created_at
                  ).toLocaleString(language === 'es' ? 'es-ES' : 'en-US')}
                </span>
              </div>
            )}
          </div>

          {/* Active Threads Compact Monitor */}
          {nerdStats && task.status === 'downloading' && task.segments && task.segments.length > 0 && (
            <div className="bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] p-2 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center justify-between">
                <span>{t('taskDetails.activeThreads', { count: task.segments.length })}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{t('taskDetails.advancedStats')}</span>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
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
                      className="bg-slate-50 dark:bg-[#111722] border border-slate-200 dark:border-[#232f42] px-2 py-1 text-xs font-mono flex items-center justify-between"
                    >
                      <span className="font-bold text-blue-900 dark:text-blue-300 text-[11px]">
                        {t('taskDetails.thread', { id: seg.id + 1 })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400">
                          {formatBytes(seg.downloaded_bytes)} / {seg.total_bytes > 0 ? formatBytes(seg.total_bytes) : '--'}
                        </span>
                        <div className="w-16 h-2 bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-600 overflow-hidden">
                          <div
                            style={{ width: `${segPct}%` }}
                            className={`h-full ${seg.status === 'completed' ? 'bg-emerald-600' : 'bg-[#1a365d] dark:bg-blue-500'}`}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-7 text-right">
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
        <div className="px-3 py-2 border-t border-slate-300 dark:border-[#202b3d] bg-slate-200 dark:bg-[#0f1520] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {task.status === 'completed' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenFile(task.file_path)}
                  className="px-2.5 sm:px-3 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-200 dark:hover:bg-[#28354c] hover:border-slate-500 dark:hover:border-[#384761] border border-slate-400 dark:border-[#2a3649] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner flex items-center gap-1.5 cursor-pointer rounded-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>{t('taskDetails.openFile')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFolder(task.file_path)}
                  className="px-2.5 sm:px-3 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-200 dark:hover:bg-[#28354c] hover:border-slate-500 dark:hover:border-[#384761] border border-slate-400 dark:border-[#2a3649] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner flex items-center gap-1.5 cursor-pointer rounded-xs transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-slate-700 dark:text-slate-400" />
                  <span>{t('taskDetails.folder')}</span>
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-200 dark:hover:bg-[#28354c] hover:border-slate-500 dark:hover:border-[#384761] border border-slate-400 dark:border-[#2a3649] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs transition-colors"
          >
            {t('taskDetails.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

