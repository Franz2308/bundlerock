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
        'grid grid-cols-12 gap-2 items-center border-b border-slate-200 py-1.5 px-1 text-[11px] transition-colors cursor-pointer',
        isSelected ? 'bg-[#e3f0fa] border-[#a6c8ff] -mx-[1px] px-[5px]' : 'hover:bg-slate-50 bg-white'
      )}
      onDoubleClick={() => task.status === 'completed' && onOpenFile(task.file_path)}
    >
      {/* 1. Index */}
      <div className="col-span-1 text-center font-bold text-slate-600">{index}</div>

      {/* 2. File Name & Origin */}
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        <div className="shrink-0 w-5 h-5 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-sm">
          {thumbnail && !imgError ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            getCategoryIcon()
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-slate-800 truncate" title={task.file_name}>{task.file_name}</span>
          <span className="text-[9px] text-slate-500 truncate" title={domain}>{downStr} de {totalStr} • {task.segments ? task.segments.length : 1} hilos activos</span>
        </div>
      </div>

      {/* 3. Size / Progress */}
      <div className="col-span-2 flex flex-col min-w-0 pr-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-slate-600 font-semibold">{totalStr}</span>
          <span className="font-bold text-slate-800">{task.progress_percentage.toFixed(0)}%</span>
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
      <div className="col-span-2 flex items-center justify-between px-2">
        <span className="font-bold text-red-600">{speedStr}</span>
        <span className="font-semibold text-slate-700">{etaStr}</span>
      </div>

      {/* 5. Status */}
      <div className="col-span-1 text-center">
        {getStatusBadge()}
      </div>

      {/* 6. Actions */}
      <div className="col-span-1 flex items-center justify-center gap-1">
        {task.status === 'downloading' && (
          <button onClick={(e) => { e.stopPropagation(); onPause(task.id); }} className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner" title="Pausar">
            <Pause className="w-3.5 h-3.5 text-slate-700" />
          </button>
        )}
        {(task.status === 'paused' || task.status === 'failed') && (
          <button onClick={(e) => { e.stopPropagation(); onResume(task.id); }} className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner" title="Reanudar">
            <Play className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        )}
        {task.status === 'completed' && (
          <button onClick={(e) => { e.stopPropagation(); onOpenFolder(task.file_path); }} className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 active:shadow-inner" title="Abrir carpeta">
            <FolderOpen className="w-3.5 h-3.5 text-slate-700" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onCancel(task.id, false); }} className="p-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-rose-600 active:shadow-inner" title="Eliminar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
