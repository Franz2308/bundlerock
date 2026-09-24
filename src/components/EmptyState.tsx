import React from 'react';
import {
  DownloadCloud,
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-300">
      <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-xl shadow-cyan-950/20 text-slate-500">
        <DownloadCloud className="w-8 h-8 text-cyan-400/80 animate-pulse" />
      </div>

      <h3 className="text-base font-bold text-slate-200 mb-1">
        {isFiltered
          ? 'No hay descargas que coincidan'
          : 'No hay descargas en la lista'}
      </h3>

      <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
        {isFiltered
          ? 'Prueba modificando tus términos de búsqueda o cambiando el filtro de categoría y estado.'
          : 'Pega un enlace HTTP/HTTPS para aprovechar la aceleración por conexiones dinámicas multisegmento.'}
      </p>

      <div className="flex items-center gap-3">
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
        <button
          onClick={onOpenNewDownload}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar descarga</span>
        </button>
      </div>
    </div>
  );
};
