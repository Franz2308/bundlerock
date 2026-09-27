import React, { useState } from 'react';
import {
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  Package,
  File,
  Play,
  Pause,
  FolderOpen,
  Info,
  X,
} from 'lucide-react';
import { DownloadTask, FileCategory } from '../types/download';
import {
  formatBytes,
  formatSpeed,
  formatETA,
  getFileCategory,
  
  
} from '../utils/formatters';

import { cn } from '../utils/cn';

interface DownloadItemProps {
  task: DownloadTask;
  viewMode?: 'detailed' | 'compact';
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string, deleteFile?: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  onInspect: (task: DownloadTask) => void;
  index?: number;
}

export const DownloadItem: React.FC<DownloadItemProps> = ({
  task,
  index = 1,
  isSelected = false,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onInspect,
}) => {
  
  
  const [imgError, setImgError] = useState(false);

  const category: FileCategory = getFileCategory(task.file_name, task.is_animated_gif);
  const thumbnail = task.thumbnail_url || task.media_thumbnail;
  
  const getCategoryIcon = () => {
    switch (category) {
      case 'video': return <Film className="w-3.5 h-3.5 text-slate-500" />;
      case 'audio': return <Music className="w-3.5 h-3.5 text-slate-500" />;
      case 'image': return <ImageIcon className="w-3.5 h-3.5 text-slate-500" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-slate-500" />;
      case 'program': return <Package className="w-3.5 h-3.5 text-slate-500" />;
      default: return <File className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (task.status) {
      case 'downloading':
        return <span className="text-blue-700 font-bold flex items-center justify-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>Descargando</span>;
      case 'paused':
        return <span className="text-slate-600 font-semibold flex items-center justify-center gap-1"><Pause className="w-2.5 h-2.5" /> En Pausa</span>;
      case 'completed':
        return <span className="text-emerald-700 font-bold">Completado</span>;
      case 'failed':
        return <span className="text-red-600 font-bold">Error</span>;
      default:
        return <span className="text-slate-500">{task.status}</span>;
    }
  };

  // Safe domain extraction
  let domain = '';
  try {
    domain = new URL(task.url).hostname;
  } catch {
    domain = task.url;
  }

  const speedStr = task.status === 'downloading' ? formatSpeed(task.speed_bps) : '0.0 MB/s';
  const etaStr = task.status === 'downloading' ? formatETA(task.downloaded_bytes, task.total_bytes, task.speed_bps) : '--';
  const totalStr = formatBytes(task.total_bytes);
  const downStr = formatBytes(task.downloaded_bytes);

  return (
    <div
      onClick={() => onSelect?.(task.id)}
      className={cn(
        'download-grid border-b border-slate-200 py-1.5 px-1 text-[11px] transition-colors cursor-pointer select-none',
        isSelected ? 'bg-[#e3f0fa] border-[#a6c8ff] -mx-[1px] px-[5px]' : 'hover:bg-slate-50 bg-white'
      )}
      onDoubleClick={() => task.status === 'completed' && onOpenFile(task.file_path)}
    >
      {/* 1. Index */}
      <div className="text-center font-bold text-slate-600">{index}</div>

      {/* 2. File Name & Origin */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0 w-5 h-5 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-sm overflow-hidden">
          {thumbnail && !imgError ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            getCategoryIcon()
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-slate-800 truncate" title={task.file_name}>{task.file_name}</span>
          <span className="text-[9px] text-slate-500 truncate" title={domain}>{downStr} de {totalStr} • {task.segments ? task.segments.length : 1} hilos activos</span>
        </div>
      </div>

      {/* 3. Size / Progress */}
      <div className="flex flex-col min-w-0 pr-1 sm:pr-2">
        <div className="flex items-center justify-between mb-0.5 text-[10px]">
          <span className="text-slate-600 font-semibold truncate">{totalStr}</span>
          <span className="font-bold text-slate-800 shrink-0 ml-1">{task.progress_percentage.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-200 border border-slate-400 rounded-none overflow-hidden flex">
          {task.status === 'completed' ? (
            <div className="w-full h-full bg-[#1a365d]"></div>
          ) : (
            <div 
              className="h-full bg-gradient-to-r from-[#1a365d] to-red-600" 
              style={{ width: `${task.progress_percentage}%` }}
            ></div>
          )}
        </div>
      </div>

      {/* 4. Speed / ETA */}
      <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] min-w-0">
        <span className="font-bold text-red-600 truncate">{speedStr}</span>
        <span className="font-semibold text-slate-700 shrink-0 ml-1">{etaStr}</span>
      </div>

      {/* 5. Status */}
      <div className="text-center min-w-0 truncate">
        {getStatusBadge()}
      </div>

      {/* 6. Actions */}
      <div className="flex items-center justify-center gap-0.5 sm:gap-1 shrink-0">
        {task.status === 'downloading' && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onPause(task.id); }} className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors" title="Pausar">
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
        {(task.status === 'paused' || task.status === 'failed') && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onResume(task.id); }} className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-emerald-600 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors" title="Reanudar">
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
        {task.status === 'completed' && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFolder(task.file_path); }} className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors" title="Abrir carpeta">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onInspect(task); }}
          className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-slate-700 hover:text-blue-700 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs transition-colors shrink-0"
          title="Propiedades y detalles"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(task.id, false); }} className="p-1 bg-slate-100 hover:bg-slate-200 hover:border-slate-500 border border-slate-400 text-rose-600 active:bg-slate-300 active:shadow-inner cursor-pointer rounded-xs shrink-0 transition-colors" title="Eliminar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
