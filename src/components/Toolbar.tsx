import React from 'react';
import {
  Search,
  X,
  Play,
  Pause,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  CheckCircle,
} from 'lucide-react';
import { DownloadTask, FileCategory, StatusFilter } from '../types/download';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: FileCategory;
  selectedStatus: StatusFilter;
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
  selectedCategory,
  selectedStatus,
  selectedTask,
  onClearSelection,
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
  const getCategoryTitle = () => {
    switch (selectedCategory) {
      case 'video':
        return 'Videos';
      case 'audio':
        return 'Música y Audio';
      case 'image':
        return 'Imágenes / GIFs';
      case 'document':
        return 'Documentos y Zips';
      case 'program':
        return 'Programas e ISOs';
      case 'other':
        return 'Otros Archivos';
      default:
        return 'Todas las Descargas';
    }
  };

  const getStatusSubtitle = () => {
    switch (selectedStatus) {
      case 'downloading':
        return '• Filtrando en curso';
      case 'paused':
        return '• Filtrando en pausa';
      case 'completed':
        return '• Filtrando completadas';
      case 'failed':
        return '• Filtrando con errores';
      default:
        return '';
    }
  };

  // Determine button states based on selection or aggregate counts
  const canResume = selectedTask
    ? selectedTask.status === 'paused' || selectedTask.status === 'failed'
    : pausedDownloadsCount > 0;

  const resumeLabel = selectedTask
    ? 'Reanudar'
    : pausedDownloadsCount > 0
    ? `Reanudar (${pausedDownloadsCount})`
    : 'Reanudar';

  const canPause = selectedTask
    ? selectedTask.status === 'downloading'
    : activeDownloadsCount > 0;

  const pauseLabel = selectedTask
    ? 'Pausar'
    : activeDownloadsCount > 0
    ? `Pausar (${activeDownloadsCount})`
    : 'Pausar';

  const canDelete = Boolean(selectedTask || totalTasksCount > 0);
  const deleteLabel = selectedTask
    ? 'Eliminar'
    : totalTasksCount > 0
    ? `Borrar todo (${totalTasksCount})`
    : 'Borrar todo';

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between gap-4 backdrop-blur-md shrink-0">
      {/* Current View Title & Selected Task Indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-2 shrink-0">
          <span>{getCategoryTitle()}</span>
          {getStatusSubtitle() && (
            <span className="text-[11px] font-normal text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/50">
              {getStatusSubtitle().replace('• ', '')}
            </span>
          )}
        </h1>

        {selectedTask && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs truncate max-w-xs animate-in fade-in">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Seleccionada:</span>
            <span className="truncate font-medium">{selectedTask.file_name}</span>
            <button
              onClick={onClearSelection}
              className="text-cyan-400 hover:text-cyan-200 cursor-pointer p-0.5"
              title="Deseleccionar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Center Search Input */}
      <div className="flex-1 max-w-md relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o enlace..."
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar Action Buttons (Always visible as requested) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Resume Button */}
        <button
          onClick={onResume}
          disabled={!canResume}
          title={
            selectedTask
              ? `Reanudar ${selectedTask.file_name}`
              : 'Reanudar todas las descargas en pausa'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            canResume
              ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-pointer'
              : 'bg-slate-900/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{resumeLabel}</span>
        </button>

        {/* Pause Button */}
        <button
          onClick={onPause}
          disabled={!canPause}
          title={
            selectedTask
              ? `Pausar ${selectedTask.file_name}`
              : 'Pausar todas las descargas activas'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            canPause
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-pointer'
              : 'bg-slate-900/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
          }`}
        >
          <Pause className="w-3.5 h-3.5" />
          <span>{pauseLabel}</span>
        </button>

        {/* Cancel / Delete Button */}
        <button
          onClick={onCancelOrDelete}
          disabled={!canDelete}
          title={
            selectedTask
              ? `Eliminar ${selectedTask.file_name}`
              : 'Borrar todas las descargas del gestor'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            canDelete
              ? 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 cursor-pointer'
              : 'bg-slate-900/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{deleteLabel}</span>
        </button>

        {/* Clear Completed Button */}
        {!selectedTask && completedDownloadsCount > 0 && onClearCompleted && (
          <button
            onClick={onClearCompleted}
            title={`Quitar ${completedDownloadsCount} descargas completadas del gestor`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Limpiar completadas ({completedDownloadsCount})</span>
          </button>
        )}

        <div className="h-6 w-px bg-slate-800 mx-1" />

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-950/70 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => onViewModeChange('detailed')}
            title="Vista detallada con barra segmentada"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'detailed'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('compact')}
            title="Vista compacta de lista"
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              viewMode === 'compact'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New Download Primary Button */}
        <button
          onClick={onOpenNewDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nueva Descarga</span>
        </button>
      </div>
    </header>
  );
};
