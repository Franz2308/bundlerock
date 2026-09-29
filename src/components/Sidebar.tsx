import React, { useState } from 'react';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { FileCategory, StatusFilter } from '../types/download';
import { useTranslation } from '../i18n';
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
  const { t } = useTranslation();

  const categories: {
    id: FileCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }[] = [
    { id: 'all', label: t('sidebar.allFiles'), icon: FolderOpen, accentColor: 'text-cyan-400' },
    { id: 'video', label: t('sidebar.video'), icon: Film, accentColor: 'text-purple-400' },
    { id: 'audio', label: t('sidebar.audio'), icon: Music, accentColor: 'text-pink-400' },
    { id: 'image', label: t('sidebar.image'), icon: ImageIcon, accentColor: 'text-amber-400' },
    { id: 'document', label: t('sidebar.document'), icon: FileText, accentColor: 'text-blue-400' },
    { id: 'program', label: t('sidebar.program'), icon: Package, accentColor: 'text-emerald-400' },
    { id: 'other', label: t('sidebar.other'), icon: File, accentColor: 'text-slate-400' },
  ];

  const statuses: {
    id: StatusFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    { id: 'all', label: t('sidebar.allStatus'), icon: Layers, color: 'text-slate-300' },
    { id: 'downloading', label: t('sidebar.downloading'), icon: ArrowDownCircle, color: 'text-cyan-400' },
    { id: 'paused', label: t('sidebar.paused'), icon: PauseCircle, color: 'text-amber-400' },
    { id: 'completed', label: t('sidebar.completed'), icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'failed', label: t('sidebar.failed'), icon: AlertCircle, color: 'text-rose-400' },
  ];

  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);

  return (
    <aside className="w-44 sm:w-48 lg:w-56 bg-slate-100 dark:bg-[#101520] border-r border-slate-300 dark:border-[#202b3d] flex flex-col h-full select-none shrink-0 transition-[width] duration-150">
      {/* Categories Section */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setCategoriesOpen(!categoriesOpen)}
          className="bg-slate-200 hover:bg-slate-300/80 dark:bg-[#161f2e] dark:hover:bg-[#1e2a3e] border-y border-slate-300 dark:border-[#202b3d] p-1 px-2 font-semibold text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center uppercase cursor-pointer transition-colors text-left"
        >
          <span className="truncate">{t('sidebar.categories')}</span>
          {categoriesOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 stroke-[2.5] shrink-0" />
          )}
        </button>
        {categoriesOpen && (
          <div className="bg-white dark:bg-[#141b27] py-1 text-sm border-b border-slate-300 dark:border-[#202b3d] flex-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 sm:px-3 py-1 cursor-pointer min-w-0',
                    isSelected
                      ? 'bg-[#e3f0fa] dark:bg-[#1c2c44] border border-[#a6c8ff] dark:border-[#2d4d7a] -my-[1px] relative z-10'
                      : 'text-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a2332] border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    <Icon className={cn('w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400', isSelected && 'text-blue-600 dark:text-blue-400')} />
                    <span className={cn("truncate text-xs flex-1 text-left", isSelected && "font-semibold text-blue-900 dark:text-blue-300")} title={cat.label}>
                      {cat.label}
                    </span>
                  </div>
                  {count > 0 && (
                    <span className={cn("text-[11px] font-bold shrink-0 ml-1.5", isSelected ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400")}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Filters Section */}
      <div className="flex flex-col mt-2">
        <button
          type="button"
          onClick={() => setStatusOpen(!statusOpen)}
          className="bg-slate-200 hover:bg-slate-300/80 dark:bg-[#161f2e] dark:hover:bg-[#1e2a3e] border-y border-slate-300 dark:border-[#202b3d] p-1 px-2 font-semibold text-xs text-slate-700 dark:text-slate-300 flex justify-between items-center uppercase cursor-pointer transition-colors text-left"
        >
          <span className="truncate">{t('sidebar.status')}</span>
          {statusOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 stroke-[2.5] shrink-0" />
          )}
        </button>
        {statusOpen && (
          <div className="bg-white dark:bg-[#141b27] py-1 text-sm border-b border-slate-300 dark:border-[#202b3d] flex-1">
            {statuses.map((st) => {
              const Icon = st.icon;
              const isSelected = selectedStatus === st.id;
              const count = statusCounts[st.id] ?? 0;

              return (
                <button
                  key={st.id}
                  onClick={() => onSelectStatus(st.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 sm:px-3 py-1 cursor-pointer min-w-0',
                    isSelected
                      ? 'bg-[#e3f0fa] dark:bg-[#1c2c44] border border-[#a6c8ff] dark:border-[#2d4d7a] -my-[1px] relative z-10'
                      : 'text-slate-800 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a2332] border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400',
                        st.id === 'downloading' && count > 0 && 'animate-spin'
                      )}
                    />
                    <span className={cn("truncate text-xs flex-1 text-left", isSelected && "font-semibold text-blue-900 dark:text-blue-300")} title={st.label}>
                      {st.label}
                    </span>
                  </div>
                  {count > 0 && (
                    <span className={cn("text-[11px] font-bold shrink-0 ml-1.5", isSelected ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400")}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Network & Storage Summary Panel */}
      <div className="mt-auto p-2 border-t border-slate-300 dark:border-[#202b3d] bg-slate-100 dark:bg-[#101520] flex items-center justify-center">
        <button
          onClick={onOpenNewDownload}
          className="w-full py-1.5 px-3 bg-slate-100 dark:bg-[#17202f] hover:bg-slate-200 dark:hover:bg-[#1f2c40] border border-slate-400 dark:border-[#2d3d54] rounded-sm text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm active:bg-slate-300 dark:active:bg-[#25354e] active:shadow-inner"
        >
          <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{t('sidebar.newDownload')}</span>
        </button>
      </div>
    </aside>
  );
};
