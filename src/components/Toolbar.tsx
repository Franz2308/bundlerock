import React from 'react';
import {
  
  
  Play,
  Pause,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  CheckCircle,
} from 'lucide-react';
import { DownloadTask, } from '../types/download';

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
    <header className="bg-slate-200 border-b border-slate-300 px-2 py-1 flex items-center justify-between gap-4 shrink-0">
      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenNewDownload}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 rounded-sm text-xs text-slate-800 shadow-sm active:shadow-inner active:bg-slate-300"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          <span>Añadir URL</span>
        </button>
        <div className="w-px h-5 bg-slate-400 mx-1"></div>
        <button
          onClick={onPause}
          disabled={!canPause}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs shadow-sm border transition-all ${
            canPause
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60'
          }`}
        >
          <Pause className="w-4 h-4 text-red-500" />
          <span>Pausar</span>
        </button>
        <button
          onClick={onResume}
          disabled={!canResume}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs shadow-sm border transition-all ${
            canResume
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60'
          }`}
        >
          <Play className="w-4 h-4 text-emerald-500" />
          <span>Reanudar</span>
        </button>
        <div className="w-px h-5 bg-slate-400 mx-1"></div>
        <button
          onClick={onCancelOrDelete}
          disabled={!canDelete}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs shadow-sm border transition-all ${
            canDelete
              ? 'bg-slate-100 hover:bg-slate-200 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300'
              : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60'
          }`}
        >
          <Trash2 className="w-4 h-4 text-slate-500" />
          <span>Eliminar</span>
        </button>
        
        {onClearCompleted && (
          <button
            onClick={onClearCompleted}
            disabled={completedDownloadsCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs shadow-sm border transition-all ${
              completedDownloadsCount > 0
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-400 text-slate-800 active:shadow-inner active:bg-slate-300'
                : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span>Limpiar completadas</span>
          </button>
        )}
      </div>

      {/* View Mode Toggle & Status */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 font-semibold">Active Chunks: {totalTasksCount * 4}</span>
        <div className="flex items-center border border-slate-400 bg-white rounded-sm">
          <button
            onClick={() => onViewModeChange('detailed')}
            className={`px-2 py-0.5 transition-colors ${
              viewMode === 'detailed' ? 'bg-[#cce8ff] text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-full bg-slate-300"></div>
          <button
            onClick={() => onViewModeChange('compact')}
            className={`px-2 py-0.5 transition-colors ${
              viewMode === 'compact' ? 'bg-[#cce8ff] text-slate-800' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
