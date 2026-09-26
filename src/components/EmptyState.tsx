import React from 'react';
import {
  FolderDown,
  Plus,
} from 'lucide-react';
import { FileCategory, StatusFilter } from '../types/download';

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
  const isFiltered =
    selectedCategory !== 'all' || selectedStatus !== 'all' || !!searchQuery;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none h-full min-h-[320px]">
      {/* Retro Icon Container */}
      <div className="w-14 h-14 bg-slate-100 border border-slate-400 flex items-center justify-center mb-3 shadow-[inset_1px_1px_0_#fff,1px_1px_2px_rgba(0,0,0,0.15)]">
        <FolderDown className="w-7 h-7 text-slate-600" />
      </div>

      <h3 className="text-sm font-bold text-slate-800 mb-1">
        {isFiltered
          ? 'No hay descargas que coincidan'
          : 'No hay descargas en la lista'}
      </h3>

      <p className="text-xs text-slate-600 max-w-sm mb-4 leading-relaxed">
        {isFiltered
          ? 'Prueba modificando tus términos de búsqueda o cambiando el filtro de categoría y estado.'
          : 'Pega un enlace HTTP/HTTPS para aprovechar la aceleración por conexiones dinámicas multisegmento.'}
      </p>

      <div className="flex items-center gap-2">
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-700 text-xs font-semibold shadow-sm active:bg-slate-300 active:shadow-inner cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
        <button
          onClick={onOpenNewDownload}
          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:bg-slate-300 active:shadow-inner flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
          <span>Agregar descarga</span>
        </button>
      </div>
    </div>
  );
};
