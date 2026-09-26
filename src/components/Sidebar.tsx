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
  
  
} from 'lucide-react';
import { FileCategory, StatusFilter } from '../types/download';

import { cn } from '../utils/cn';

interface SidebarProps {
  selectedCategory: FileCategory;
  onSelectCategory: (category: FileCategory) => void;
  selectedStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
  categoryCounts: Record<FileCategory, number>;
  statusCounts: Record<StatusFilter, number>;
  onOpenNewDownload: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  categoryCounts,
  statusCounts,
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
    <aside className="w-56 bg-slate-100 border-r border-slate-300 flex flex-col h-full select-none shrink-0">
      {/* Categories Section */}
      <div className="flex flex-col">
        <div className="bg-slate-200 border-y border-slate-300 p-1 px-2 font-semibold text-xs text-slate-700 flex justify-between uppercase">
          <span>Transfer Categories</span>
          <span>⬇</span>
        </div>
        <div className="bg-white py-1 text-sm border-b border-slate-300 flex-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1 cursor-pointer',
                  isSelected
                    ? 'bg-[#e3f0fa] border border-[#a6c8ff] -my-[1px] relative z-10'
                    : 'text-slate-800 hover:bg-slate-50 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon className={cn('w-4 h-4 text-slate-500', isSelected && 'text-blue-600')} />
                  <span className={cn("truncate text-xs", isSelected && "font-semibold text-blue-900")}>{cat.label}</span>
                </div>
                {count > 0 && (
                  <span className={cn("text-[11px] font-bold", isSelected ? "text-blue-700" : "text-slate-500")}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Filters Section */}
      <div className="flex flex-col mt-2">
        <div className="bg-slate-200 border-y border-slate-300 p-1 px-2 font-semibold text-xs text-slate-700 flex justify-between uppercase">
          <span>Estado / Filtro</span>
          <span>⬇</span>
        </div>
        <div className="bg-white py-1 text-sm border-b border-slate-300 flex-1">
          {statuses.map((st) => {
            const Icon = st.icon;
            const isSelected = selectedStatus === st.id;
            const count = statusCounts[st.id] ?? 0;

            return (
              <button
                key={st.id}
                onClick={() => onSelectStatus(st.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-1 cursor-pointer',
                  isSelected
                    ? 'bg-[#e3f0fa] border border-[#a6c8ff] -my-[1px] relative z-10'
                    : 'text-slate-800 hover:bg-slate-50 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isSelected ? 'text-blue-600' : 'text-slate-500',
                      st.id === 'downloading' && count > 0 && 'animate-spin'
                    )}
                  />
                  <span className={cn("truncate text-xs", isSelected && "font-semibold text-blue-900")}>{st.label}</span>
                </div>
                {count > 0 && (
                  <span className={cn("text-[11px] font-bold", isSelected ? "text-blue-700" : "text-slate-500")}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Network & Storage Summary Panel (Moved some to bottom bar but keep a tiny box here) */}
      <div className="mt-auto p-2 border-t border-slate-300 bg-slate-100 flex items-center justify-center">
        <button
          onClick={onOpenNewDownload}
          className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-400 rounded-sm text-slate-800 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm active:bg-slate-300 active:shadow-inner"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          <span>Nueva Descarga</span>
        </button>
      </div>
    </aside>
  );
};
