import React from 'react';
import {
  Layers,
  FolderOpen,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Package,
  File,
  Plus,
  ArrowDownCircle,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap,
} from 'lucide-react';
import { FileCategory, StatusFilter } from '../types/download';
import { formatBytes, formatSpeed } from '../utils/formatters';
import { cn } from '../utils/cn';

interface SidebarProps {
  selectedCategory: FileCategory;
  onSelectCategory: (category: FileCategory) => void;
  selectedStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
  categoryCounts: Record<FileCategory, number>;
  statusCounts: Record<StatusFilter, number>;
  totalSpeedBps: number;
  totalActiveDownloads: number;
  totalCompletedSize: number;
  onOpenNewDownload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  categoryCounts,
  statusCounts,
  totalSpeedBps,
  totalActiveDownloads,
  totalCompletedSize,
  onOpenNewDownload,
}) => {
  const categories: {
    id: FileCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }[] = [
    { id: 'all', label: 'Todos los archivos', icon: FolderOpen, accentColor: 'text-cyan-400' },
    { id: 'video', label: 'Videos', icon: Film, accentColor: 'text-purple-400' },
    { id: 'audio', label: 'Música y Audio', icon: Music, accentColor: 'text-pink-400' },
    { id: 'image', label: 'Imágenes / GIFs', icon: ImageIcon, accentColor: 'text-amber-400' },
    { id: 'document', label: 'Documentos y Zips', icon: FileText, accentColor: 'text-blue-400' },
    { id: 'program', label: 'Programas e ISOs', icon: Package, accentColor: 'text-emerald-400' },
    { id: 'other', label: 'Otros Archivos', icon: File, accentColor: 'text-slate-400' },
  ];

  const statuses: {
    id: StatusFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    { id: 'all', label: 'Todos los estados', icon: Layers, color: 'text-slate-300' },
    { id: 'downloading', label: 'Descargando', icon: ArrowDownCircle, color: 'text-cyan-400' },
    { id: 'paused', label: 'En Pausa', icon: PauseCircle, color: 'text-amber-400' },
    { id: 'completed', label: 'Completadas', icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'failed', label: 'Con Errores', icon: AlertCircle, color: 'text-rose-400' },
  ];

  return (
    <aside className="w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col h-full select-none shrink-0 backdrop-blur-md">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black tracking-wider">
            <Zap className="w-5 h-5 fill-white text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                BundleRock
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Acelerador Multihilo</p>
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="p-3">
        <button
          onClick={onOpenNewDownload}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all duration-200 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nueva Descarga</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 custom-scrollbar">
        {/* File Categories */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
            Categorías
          </div>
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group cursor-pointer',
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={cn(
                        'w-4 h-4 transition-colors',
                        isSelected ? 'text-cyan-400' : cat.accentColor
                      )}
                    />
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-mono px-1.5 py-0.5 rounded-md min-w-[20px] text-center transition-colors',
                      isSelected
                        ? 'bg-cyan-500/25 text-cyan-200 font-semibold'
                        : 'bg-slate-800/80 text-slate-400 group-hover:bg-slate-700'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filters */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
            Estado de Descarga
          </div>
          <div className="space-y-0.5">
            {statuses.map((st) => {
              const Icon = st.icon;
              const isSelected = selectedStatus === st.id;
              const count = statusCounts[st.id] ?? 0;

              return (
                <button
                  key={st.id}
                  onClick={() => onSelectStatus(st.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all group cursor-pointer',
                    isSelected
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        isSelected ? 'text-blue-400' : st.color,
                        st.id === 'downloading' && count > 0 && 'animate-spin'
                      )}
                    />
                    <span className="truncate">{st.label}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-mono px-1.5 py-0.5 rounded-md min-w-[20px] text-center transition-colors',
                      isSelected
                        ? 'bg-blue-500/30 text-blue-200 font-semibold'
                        : 'bg-slate-800/80 text-slate-400 group-hover:bg-slate-700'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Network & Storage Summary Panel */}
      <div className="p-3 border-t border-slate-800/90 bg-slate-950/60">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Velocidad Total
            </span>
            <span
              className={cn(
                'font-mono font-bold text-xs',
                totalSpeedBps > 0 ? 'text-cyan-400 animate-pulse' : 'text-slate-500'
              )}
            >
              {formatSpeed(totalSpeedBps)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>En ejecución</span>
            <span className="font-mono text-slate-200 font-semibold">
              {totalActiveDownloads} {totalActiveDownloads === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Descargado</span>
            <span className="font-mono text-slate-300">
              {formatBytes(totalCompletedSize)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
