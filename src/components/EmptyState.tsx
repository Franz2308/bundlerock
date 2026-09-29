import React from 'react';
import {
  FolderDown,
  Plus,
} from 'lucide-react';
import { FileCategory, StatusFilter } from '../types/download';
import { useTranslation } from '../i18n';

interface EmptyStateProps {
  selectedCategory: FileCategory;
  selectedStatus: StatusFilter;
  searchQuery: string;
  onOpenNewDownload: () => void;
  onResetFilters: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  selectedCategory,
  selectedStatus,
  searchQuery,
  onOpenNewDownload,
  onResetFilters,
}) => {
  const { t } = useTranslation();
  const isFiltered =
    selectedCategory !== 'all' || selectedStatus !== 'all' || Boolean(searchQuery);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none h-full min-h-[320px]">
      {/* Retro Icon Container */}
      <div className="w-14 h-14 bg-slate-100 dark:bg-[#1a2332] border border-slate-400 dark:border-[#33425a] flex items-center justify-center mb-3 shadow-[inset_1px_1px_0_#fff,1px_1px_2px_rgba(0,0,0,0.15)] dark:shadow-none">
        <FolderDown className="w-7 h-7 text-slate-600 dark:text-slate-300" />
      </div>

      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
        {isFiltered
          ? t('emptyState.matchingTitle')
          : t('emptyState.defaultTitle')}
      </h3>

      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
        {isFiltered
          ? t('emptyState.matchingDesc')
          : t('emptyState.defaultDesc')}
      </p>

      <div className="flex items-center gap-2">
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="px-3 py-1.5 bg-slate-100 dark:bg-[#17202f] hover:bg-slate-200 dark:hover:bg-[#202b3d] border border-slate-400 dark:border-[#384761] text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm active:bg-slate-300 dark:active:bg-[#28354c] active:shadow-inner cursor-pointer transition-colors"
          >
            {t('emptyState.clearFilters')}
          </button>
        )}
        <button
          onClick={onOpenNewDownload}
          className="px-4 py-1.5 bg-slate-100 dark:bg-[#17202f] hover:bg-slate-200 dark:hover:bg-[#202b3d] border border-slate-400 dark:border-[#384761] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-sm active:bg-slate-300 dark:active:bg-[#28354c] active:shadow-inner flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
          <span>{t('emptyState.addDownload')}</span>
        </button>
      </div>
    </div>
  );
};
