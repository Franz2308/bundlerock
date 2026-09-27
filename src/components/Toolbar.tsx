import React from 'react';
import {
  Play,
  Pause,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  CheckCircle,
  Settings,
} from 'lucide-react';
import { DownloadTask } from '../types/download';

interface ToolbarProps {
  selectedTask: DownloadTask | null;
  onClearSelection: () => void;
  totalTasksCount: number;
  activeDownloadsCount: number;
  pausedDownloadsCount: number;
  completedDownloadsCount: number;
  viewMode: 'detailed' | 'compact';
  onViewModeChange: (mode: 'detailed' | 'compact') => void;
  onOpenNewDownload: () => void;
  onOpenSettings?: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancelOrDelete: () => void;
  onClearCompleted?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  selectedTask,
  totalTasksCount,
  activeDownloadsCount,
  pausedDownloadsCount,
  completedDownloadsCount,
  viewMode,
  onViewModeChange,
  onOpenNewDownload,
  onOpenSettings,
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
    <header className="bg-slate-200 dark:bg-[#111723] border-b border-slate-300 dark:border-[#202b3d] px-2 py-1 flex items-center justify-between gap-2 shrink-0 min-w-0 overflow-x-auto transition-colors">
      {/* Action Buttons */}
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onOpenNewDownload}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] border border-slate-400 dark:border-[#303f56] rounded-xs text-xs text-slate-800 dark:text-slate-200 shadow-xs active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] cursor-pointer shrink-0 transition-colors"
          title="Añadir URL"
        >
          <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline font-medium">Añadir URL</span>
        </button>
        <div className="w-px h-5 bg-slate-400 dark:bg-[#2f3d54] mx-0.5 sm:mx-1 shrink-0"></div>
        <button
          type="button"
          onClick={onPause}
          disabled={!canPause}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canPause
              ? 'bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] cursor-pointer'
              : 'bg-slate-200 dark:bg-[#131b28] border-slate-300 dark:border-[#222c3c] text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
          }`}
          title="Pausar"
        >
          <Pause className="w-4 h-4 text-red-500 dark:text-red-400" />
          <span className="hidden sm:inline font-medium">Pausar</span>
        </button>
        <button
          type="button"
          onClick={onResume}
          disabled={!canResume}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canResume
              ? 'bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] cursor-pointer'
              : 'bg-slate-200 dark:bg-[#131b28] border-slate-300 dark:border-[#222c3c] text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
          }`}
          title="Reanudar"
        >
          <Play className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span className="hidden sm:inline font-medium">Reanudar</span>
        </button>
        <div className="w-px h-5 bg-slate-400 dark:bg-[#2f3d54] mx-0.5 sm:mx-1 shrink-0"></div>
        <button
          type="button"
          onClick={onCancelOrDelete}
          disabled={!canDelete}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
            canDelete
              ? 'bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] cursor-pointer'
              : 'bg-slate-200 dark:bg-[#131b28] border-slate-300 dark:border-[#222c3c] text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
          }`}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="hidden sm:inline font-medium">Eliminar</span>
        </button>
        
        {onClearCompleted && (
          <button
            type="button"
            onClick={onClearCompleted}
            disabled={completedDownloadsCount === 0}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xs text-xs shadow-xs border transition-all shrink-0 ${
              completedDownloadsCount > 0
                ? 'bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] cursor-pointer'
                : 'bg-slate-200 dark:bg-[#131b28] border-slate-300 dark:border-[#222c3c] text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
            }`}
            title="Limpiar completadas"
          >
            <CheckCircle className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span className="hidden md:inline font-medium">Limpiar completadas</span>
            <span className="hidden sm:inline md:hidden font-medium">Limpiar</span>
          </button>
        )}
      </div>

      {/* Right Controls: View Mode Toggle & Settings */}
      <div className="flex items-center ml-auto gap-1.5 shrink-0">
        <div className="flex items-center border border-slate-400 dark:border-[#384761] bg-white dark:bg-[#1a2332] rounded-xs overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => onViewModeChange('detailed')}
            className={`px-2.5 py-1 transition-colors cursor-pointer flex items-center justify-center ${
              viewMode === 'detailed'
                ? 'bg-[#cce8ff] dark:bg-[#203a63] text-slate-900 dark:text-blue-200 font-bold border-r border-slate-300 dark:border-[#2d3f5c]'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#243147] hover:text-slate-800 dark:hover:text-slate-200 border-r border-slate-300 dark:border-[#2d3f5c]'
            }`}
            title="Vista detallada (Lista)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('compact')}
            className={`px-2.5 py-1 transition-colors cursor-pointer flex items-center justify-center ${
              viewMode === 'compact'
                ? 'bg-[#cce8ff] dark:bg-[#203a63] text-slate-900 dark:text-blue-200 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#243147] hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Vista compacta (Tarjetas)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#243147] hover:border-slate-500 dark:hover:border-slate-400 border border-slate-400 dark:border-[#384761] rounded-xs text-xs text-slate-800 dark:text-slate-200 shadow-xs active:shadow-inner active:bg-slate-300 dark:active:bg-[#2d3d57] cursor-pointer shrink-0 transition-colors"
            title="Configuración y Ajustes (Ctrl+,)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span className="hidden lg:inline font-medium">Ajustes</span>
          </button>
        )}
      </div>
    </header>
  );
};
