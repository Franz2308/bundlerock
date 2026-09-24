import React, { useState } from 'react';
import { DownloadSegment, DownloadStatus } from '../types/download';
import { formatBytes, formatSpeed } from '../utils/formatters';
import { Zap } from 'lucide-react';
import { cn } from '../utils/cn';

interface SegmentedProgressBarProps {
  segments?: DownloadSegment[];
  progressPercentage: number;
  status: DownloadStatus;
  totalBytes?: number | null;
  downloadedBytes?: number;
  speedBps?: number;
  className?: string;
  showTooltips?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  segments = [],
  progressPercentage,
  status,
  totalBytes,
  downloadedBytes = 0,
  speedBps = 0,
  className,
  showTooltips = true,
  size = 'md',
}) => {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  const heightClasses = {
    sm: 'h-2',
    md: 'h-3.5',
    lg: 'h-5',
  };

  const isDownloading = status === 'downloading';
  const isCompleted = status === 'completed';
  const isPaused = status === 'paused';
  const isFailed = status === 'failed';

  // If there are segments defined and totalBytes > 0, render segmented modern bar
  const hasSegments = segments && segments.length > 0;
  const activeDownloadingCount = hasSegments
    ? segments.filter((s) => s.status === 'downloading').length
    : 0;

  return (
    <div className={cn('relative w-full select-none', className)}>
      {/* Outer Glow and Frame */}
      <div
        className={cn(
          'relative w-full rounded-lg bg-slate-950/80 p-[2.5px] border border-slate-700/60 shadow-inner backdrop-blur-sm transition-all duration-300',
          isDownloading && 'border-cyan-500/40 shadow-[0_0_16px_rgba(6,182,212,0.15)]',
          isCompleted && 'border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
          isPaused && 'border-amber-500/30'
        )}
      >
        <div
          className={cn(
            'relative w-full rounded-[5px] flex items-stretch',
            heightClasses[size]
          )}
        >
          {hasSegments ? (
            /* Multi-segment modern track with rounded micro-blocks */
            <div className="flex w-full h-full gap-[2px] bg-slate-900/90 rounded-[4px]">
              {segments.map((seg, index) => {
                const segPercent =
                  seg.total_bytes > 0
                    ? Math.min(100, Math.max(0, (seg.downloaded_bytes / seg.total_bytes) * 100))
                    : seg.status === 'completed'
                    ? 100
                    : 0;

                const segWidthRatio =
                  totalBytes && totalBytes > 0 && seg.total_bytes > 0
                    ? `${(seg.total_bytes / totalBytes) * 100}%`
                    : `${100 / segments.length}%`;

                const isSegDownloading =
                  seg.status === 'downloading' && isDownloading;
                const isSegCompleted =
                  seg.status === 'completed' || segPercent >= 100;
                const isSegFailed = seg.status === 'failed';

                // Calculate connection speed
                const segSpeed =
                  isSegDownloading && speedBps > 0 && activeDownloadingCount > 0
                    ? Math.round(speedBps / activeDownloadingCount)
                    : 0;

                const isFirst = index === 0;
                const isLast = index === segments.length - 1;
                const tooltipAlignClass = isFirst
                  ? 'left-0 translate-x-0'
                  : isLast
                  ? 'right-0 translate-x-0 left-auto'
                  : 'left-1/2 -translate-x-1/2';
                const arrowAlignClass = isFirst
                  ? 'ml-4'
                  : isLast
                  ? 'mr-4 ml-auto'
                  : 'mx-auto';

                return (
                  <div
                    key={seg.id}
                    style={{ width: segWidthRatio }}
                    onMouseEnter={() => showTooltips && setActiveTooltip(seg.id)}
                    onMouseLeave={() => showTooltips && setActiveTooltip(null)}
                    className={cn(
                      'relative h-full bg-slate-800/80 rounded-[3px] transition-colors group cursor-pointer',
                      isFirst && 'rounded-l-[4px]',
                      isLast && 'rounded-r-[4px]'
                    )}
                  >
                    {/* Segment Fill */}
                    <div
                      style={{ width: `${segPercent}%` }}
                      className={cn(
                        'h-full rounded-[2.5px] transition-all duration-200 relative overflow-hidden',
                        isSegCompleted
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          : isSegDownloading
                          ? 'bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500'
                          : isPaused
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : isSegFailed
                          ? 'bg-gradient-to-r from-rose-500 to-red-400'
                          : 'bg-slate-600/70'
                      )}
                    >
                      {/* Active Cyber Shimmer Effect */}
                      {isSegDownloading && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer" />
                      )}
                    </div>

                    {/* Active Thread Pulse Beacon at download head */}
                    {isSegDownloading && segPercent > 0 && segPercent < 100 && (
                      <div
                        style={{ left: `${segPercent}%` }}
                        className="absolute top-0 bottom-0 w-[3px] -ml-[1.5px] bg-cyan-200 shadow-[0_0_8px_#38bdf8] animate-pulse z-10 rounded-full"
                      />
                    )}

                    {/* Modern Glassmorphic Tooltip (Unclipped with connection speed & byte range) */}
                    {showTooltips && activeTooltip === seg.id && (
                      <div
                        className={cn(
                          'absolute bottom-full mb-2.5 z-50 pointer-events-none min-w-[220px] animate-in fade-in zoom-in-95 duration-150',
                          tooltipAlignClass
                        )}
                      >
                        <div className="bg-slate-900/95 border border-cyan-500/40 text-slate-100 rounded-xl p-3 shadow-2xl shadow-cyan-950/50 backdrop-blur-md text-xs">
                          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800 font-semibold">
                            <span className="flex items-center gap-1.5 text-cyan-400">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  isSegCompleted
                                    ? 'bg-emerald-400'
                                    : isSegDownloading
                                    ? 'bg-cyan-400 animate-ping'
                                    : isPaused
                                    ? 'bg-amber-400'
                                    : 'bg-slate-500'
                                )}
                              />
                              Hilo #{seg.id + 1}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold',
                                isSegCompleted
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                  : isSegDownloading
                                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 animate-pulse'
                                  : isPaused
                                  ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                                  : 'bg-slate-800 text-slate-400'
                              )}
                            >
                              {seg.status}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                            {/* Connection speed */}
                            <div className="flex justify-between items-center text-slate-300">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                                Velocidad hilo:
                              </span>
                              <span className="font-bold text-cyan-300">
                                {isSegDownloading ? formatSpeed(segSpeed) : '--'}
                              </span>
                            </div>

                            <div className="flex justify-between text-slate-300">
                              <span className="text-slate-400">Progreso hilo:</span>
                              <span className="font-semibold text-cyan-300">
                                {segPercent.toFixed(1)}%
                              </span>
                            </div>

                            <div className="flex justify-between text-slate-400">
                              <span>Descargado:</span>
                              <span className="text-slate-200">
                                {formatBytes(seg.downloaded_bytes)} /{' '}
                                {seg.total_bytes > 0
                                  ? formatBytes(seg.total_bytes)
                                  : 'Dinámico'}
                              </span>
                            </div>

                            <div className="flex justify-between text-slate-500 text-[10px]">
                              <span>Rango bytes:</span>
                              <span className="text-slate-400">
                                {seg.start_byte.toLocaleString()} -{' '}
                                {seg.end_byte === 18446744073709551615
                                  ? 'Fin'
                                  : seg.end_byte.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Mini visual indicator */}
                          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${segPercent}%` }}
                              className={cn(
                                'h-full transition-all duration-150',
                                isSegCompleted
                                  ? 'bg-emerald-400'
                                  : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                              )}
                            />
                          </div>
                        </div>

                        {/* Tooltip Arrow */}
                        <div
                          className={cn(
                            'w-2.5 h-2.5 bg-slate-900 border-r border-b border-cyan-500/40 rotate-45 -mt-1',
                            arrowAlignClass
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Single continuous neon bar (for single thread or before segments split) */
            <div className="relative w-full h-full bg-slate-900/90 rounded-[4px] overflow-hidden">
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progressPercentage))}%`,
                }}
                className={cn(
                  'h-full transition-all duration-300 relative overflow-hidden rounded-[3px]',
                  isCompleted
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : isDownloading
                    ? 'bg-gradient-to-r from-cyan-500 via-sky-400 to-violet-500 shadow-[0_0_14px_rgba(6,182,212,0.6)]'
                    : isPaused
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                    : isFailed
                    ? 'bg-gradient-to-r from-rose-500 to-red-500'
                    : 'bg-slate-600/60'
                )}
              >
                {isDownloading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-label showing segments overview */}
      {hasSegments && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full',
                isDownloading ? 'bg-cyan-400 animate-ping' : 'bg-cyan-400/80'
              )}
            />
            <span>
              {segments.length} conexiones multihilo activas
            </span>
          </div>
          <div>
            {formatBytes(downloadedBytes)} de{' '}
            {totalBytes ? formatBytes(totalBytes) : 'Tamaño dinámico'} (
            {progressPercentage.toFixed(1)}%)
          </div>
        </div>
      )}
    </div>
  );
};
