import React from 'react';
import {
  Play,
  Pause,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  CheckCircle,
  Search,
  X,
} from 'lucide-react';
import { DownloadTask } from '../types/download';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTask: DownloadTask | null;
  onClearSelection: () => void;
  totalTasksCount: number;
  activeDownloadsCount: number;
  pausedDownloadsCount: number;
  completedDownloadsCount: number;
  viewMode: 'detailed' | 'compact';
  onViewModeChange: (mode: 'detailed' | 'compact') => void;
  onOpenNewDownload: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancelOrDelete: () => void;
  onClearCompleted?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedTask,
  
  totalTasksCount,
  activeDownloadsCount,
  pausedDownloadsCount,
  completedDownloadsCount,
  viewMode,
  onViewModeChange,
  onOpenNewDownload,
  onPause,
  onResume,
  onCancelOrDelete,
  onClearCompleted,
}) => {
  // Determine button states based on selection or aggregate counts
  const canResume = selectedTask
    ? selectedTask.status === 'paused' || selectedTask.status === 'failed'
    : pausedDownloadsCount > 0;

  const canPause = selectedTask
    ? selectedTask.status === 'downloading'
    : activeDownloadsCount > 0;

  const canDelete = Boolean(selectedTask || totalTasksCount > 0);

  return (
    <header className="bg-slate-200 border-b border-slate-300 px-2 py-1 flex items-center justify-between gap-2 shrink-0 min-w-0 overflow-x-auto">
      {/* Action Buttons */}
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onOpenNewDownload}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 rounded-xs text-xs text-slate-800 shadow-xs active:shadow-inner active:bg-slate-300 cursor-pointer shrink-0 transition-colors"
          title="Añadir URL"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline font-medium">Añadir URL</span>
        </button>
        <div className="w-px h-5 bg-slate-400 mx-0.5 sm:mx-1 shrink-0"></div>
        <button
          type="button"
          onClick={onPause}
          disabled={!canPause}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canPause
              ? 'bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300 cursor-pointer'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 cursor-not-allowed'
          }`}
          title="Pausar"
        >
          <Pause className="w-4 h-4 text-red-500" />
          <span className="hidden sm:inline font-medium">Pausar</span>
        </button>
        <button
          type="button"
          onClick={onResume}
          disabled={!canResume}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canResume
              ? 'bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300 cursor-pointer'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 cursor-not-allowed'
          }`}
          title="Reanudar"
        >
          <Play className="w-4 h-4 text-emerald-500" />
          <span className="hidden sm:inline font-medium">Reanudar</span>
        </button>
        <div className="w-px h-5 bg-slate-400 mx-0.5 sm:mx-1 shrink-0"></div>
        <button
          type="button"
          onClick={onCancelOrDelete}
          disabled={!canDelete}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canDelete
              ? 'bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300 cursor-pointer'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 cursor-not-allowed'
          }`}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline font-medium">Eliminar</span>
        </button>
        
        {onClearCompleted && (
          <button
            type="button"
            onClick={onClearCompleted}
            disabled={completedDownloadsCount === 0}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
              completedDownloadsCount > 0
                ? 'bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300 cursor-pointer'
                : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60 cursor-not-allowed'
            }`}
            title="Limpiar completadas"
          >
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span className="hidden md:inline font-medium">Limpiar completadas</span>
            <span className="hidden sm:inline md:hidden font-medium">Limpiar</span>
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative flex items-center min-w-0 max-w-44 sm:max-w-56 flex-1 mx-1 sm:mx-2">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar descargas..."
          className="w-full pl-7 pr-6 py-0.5 text-xs bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 rounded-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-1 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            title="Borrar búsqueda"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* View Mode Toggle & Status */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="text-[11px] text-slate-500 font-semibold hidden lg:inline">Active Chunks: {totalTasksCount * 4}</span>
        <div className="flex items-center border border-slate-400 bg-white rounded-xs overflow-hidden">
          <button
            type="button"
            onClick={() => onViewModeChange('detailed')}
            className={`px-2 py-0.5 transition-colors cursor-pointer ${
              viewMode === 'detailed' ? 'bg-[#cce8ff] text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Vista detallada"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-full bg-slate-300"></div>
          <button
            type="button"
            onClick={() => onViewModeChange('compact')}
            className={`px-2 py-0.5 transition-colors cursor-pointer ${
              viewMode === 'compact' ? 'bg-[#cce8ff] text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Vista compacta"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
