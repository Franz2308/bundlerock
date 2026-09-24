import React from 'react';
import {
  X,
  Cpu,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { DownloadTask } from '../types/download';
import { formatBytes, formatSpeed } from '../utils/formatters';
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
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 truncate max-w-md">
                {task.file_name}
              </h2>
              <p className="text-xs text-slate-400">
                Inspección técnica multihilo ({task.num_connections} hilos)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Main Visual Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Progreso Global:</span>
              <span className="font-mono font-bold text-cyan-400 text-sm">
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
              size="lg"
              showTooltips={true}
            />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[11px] text-slate-400">Velocidad actual</div>
              <div className="text-xs font-mono font-bold text-cyan-300 mt-1">
                {formatSpeed(task.speed_bps)}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[11px] text-slate-400">Descargado</div>
              <div className="text-xs font-mono font-bold text-slate-200 mt-1">
                {formatBytes(task.downloaded_bytes)}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[11px] text-slate-400">Tamaño Total</div>
              <div className="text-xs font-mono font-bold text-slate-200 mt-1">
                {formatBytes(task.total_bytes)}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[11px] text-slate-400">Estado</div>
              <div className="text-xs font-bold text-cyan-400 mt-1 uppercase">
                {task.status}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3 pb-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 shrink-0">URL:</span>
              <span className="font-mono text-slate-200 truncate select-all text-right" title={task.url}>
                {task.url}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 pb-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 shrink-0">Ruta en disco:</span>
              <span className="font-mono text-slate-200 truncate select-all text-right" title={task.file_path}>
                {task.file_path}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Acepta Rangos (Multisegmento):</span>
              <span className="font-mono text-slate-200">
                {task.accept_ranges ? 'Sí (Acelerado)' : 'No (Hilo único)'}
              </span>
            </div>
            {task.etag && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ETag:</span>
                <span className="font-mono text-slate-400 text-[11px]">{task.etag}</span>
              </div>
            )}
          </div>

          {/* Thread / Segment Detailed List */}
          {task.segments && task.segments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>Segmentos de Descarga en Vivo</span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {task.segments.length} conexiones activas
                </span>
              </h3>

              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
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
                      className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-xs font-mono flex flex-col gap-1.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-300">
                            Hilo #{seg.id + 1}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Offset: {seg.start_byte.toLocaleString()} -{' '}
                            {seg.end_byte === 18446744073709551615
                              ? 'Fin'
                              : seg.end_byte.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">
                            {formatBytes(seg.downloaded_bytes)} /{' '}
                            {seg.total_bytes > 0
                              ? formatBytes(seg.total_bytes)
                              : '--'}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold',
                              seg.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-400'
                                : seg.status === 'downloading'
                                ? 'bg-cyan-950 text-cyan-400 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            )}
                          >
                            {segPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${segPct}%` }}
                          className={cn(
                            'h-full transition-all duration-150',
                            seg.status === 'completed'
                              ? 'bg-emerald-400'
                              : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {task.status === 'completed' && (
              <>
                <button
                  onClick={() => onOpenFile(task.file_path)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Archivo</span>
                </button>
                <button
                  onClick={() => onOpenFolder(task.file_path)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Carpeta</span>
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
