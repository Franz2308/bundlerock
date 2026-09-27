import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  AlertTriangle,
  Film,
  Music,
  Download,
  Loader2,
} from 'lucide-react';
import { MediaFormatOption } from '../types/download';
import { formatBytes } from '../utils/formatters';

interface MultiFormatConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
  selectedFormats: MediaFormatOption[];
  fileNameBase: string;
  isStarting?: boolean;
}

export const MultiFormatConfirmModal: React.FC<MultiFormatConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedFormats,
  fileNameBase,
  isStarting = false,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isStarting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStarting, onClose]);

  if (!isOpen) return null;

  const totalApproxSize = selectedFormats.reduce(
    (sum, fmt) => sum + (fmt.filesize_approx || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-lg bg-slate-100 border border-slate-400 shadow-2xl text-slate-800 flex flex-col max-h-[88vh] my-auto">
        {/* Win32 Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 flex items-center justify-between bg-[#1a365d] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-300" />
            <h3 className="text-xs font-bold uppercase tracking-wide">
              Aviso: Descarga Multiformato
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="p-0.5 hover:bg-red-600 disabled:opacity-50 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto text-xs min-h-0 flex-1 custom-scrollbar">
          {/* Warning Advisory Banner */}
          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-amber-900">
                Se descargarán {selectedFormats.length} variantes simultáneas
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ha seleccionado múltiples resoluciones o formatos para este enlace.
                El programa iniciará tareas de descarga independientes para cada uno,
                lo que generará archivos separados en disco y consumirá mayor ancho de banda de red.
              </p>
            </div>
          </div>

          {/* Formats List Panel */}
          <div className="bg-white border border-slate-300 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold text-xs border-b border-slate-200 pb-1.5">
              <span>Flujos a descargar ({selectedFormats.length}):</span>
              {totalApproxSize > 0 && (
                <span className="text-[11px] font-mono text-slate-500">
                  Total est.: ~{formatBytes(totalApproxSize)}
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {selectedFormats.map((fmt) => {
                const cleanTag = (fmt.quality_label || fmt.ext).replace(/[<>:"/\\|?*]/g, '_').trim();
                const targetName = `${fileNameBase || 'archivo'} [${cleanTag}].${fmt.ext}`;

                return (
                  <div
                    key={fmt.format_id}
                    className="p-2 bg-slate-50 border border-slate-300 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0 text-slate-600">
                        {fmt.is_audio_only ? (
                          <Music className="w-3.5 h-3.5 text-pink-600" />
                        ) : (
                          <Film className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate text-xs" title={targetName}>
                          {targetName}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2">
                          <span className="font-bold text-blue-800">{fmt.quality_label}</span>
                          <span>•</span>
                          <span className="uppercase font-mono">{fmt.ext}</span>
                          {fmt.resolution && <span>• {fmt.resolution}</span>}
                        </div>
                      </div>
                    </div>

                    {fmt.filesize_approx ? (
                      <span className="text-[11px] font-mono font-semibold text-slate-700 shrink-0">
                        ~{formatBytes(fmt.filesize_approx)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Do Not Show Again Checkbox */}
          <label className="flex items-center gap-2.5 p-2 bg-slate-200/60 border border-slate-300 hover:bg-slate-200 transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded-none border-slate-400 focus:ring-0 cursor-pointer accent-blue-600"
            />
            <span className="text-xs text-slate-800 font-medium">
              No volver a mostrar esta advertencia en futuras descargas múltiples
            </span>
          </label>
        </div>

        {/* Win32 Footer Actions */}
        <div className="px-4 py-2 border-t border-slate-300 bg-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-300 disabled:opacity-50 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:shadow-inner cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isStarting}
            onClick={() => onConfirm(dontShowAgain)}
            className="px-5 py-1.5 bg-[#1a365d] hover:bg-[#152e4d] disabled:opacity-50 text-white text-xs font-bold shadow-sm active:shadow-inner flex items-center gap-1.5 cursor-pointer"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Iniciando descargas...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-cyan-300" />
                <span>Continuar con la descarga ({selectedFormats.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
