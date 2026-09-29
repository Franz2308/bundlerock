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
import { useTranslation } from '../i18n';

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
  const { t, language } = useTranslation();
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

  const fallbackFileBase = fileNameBase || (language === 'es' ? 'archivo' : 'file');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-lg bg-slate-100 dark:bg-[#141b27] border border-slate-400 dark:border-[#2d3a4f] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col max-h-[88vh] my-auto">
        {/* Win32 Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 dark:border-[#202b3d] flex items-center justify-between bg-[#1a365d] dark:bg-[#12233c] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-300" />
            <h3 className="text-xs font-bold uppercase tracking-wide">
              {t('multiFormat.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="p-0.5 hover:bg-red-600 disabled:opacity-50 text-white transition-colors cursor-pointer"
            title={t('multiFormat.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto text-xs min-h-0 flex-1 custom-scrollbar">
          {/* Warning Advisory Banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-amber-900 dark:text-amber-300">
                {t('multiFormat.warningTitle', { count: selectedFormats.length })}
              </h4>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">
                {t('multiFormat.warningDesc')}
              </p>
            </div>
          </div>

          {/* Formats List Panel */}
          <div className="bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-[#232f42] pb-1.5">
              <span>{t('multiFormat.streamsToDownload', { count: selectedFormats.length })}</span>
              {totalApproxSize > 0 && (
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {t('multiFormat.totalEst', { size: formatBytes(totalApproxSize) })}
                </span>
              )}
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
              {selectedFormats.map((fmt) => {
                const cleanTag = (fmt.quality_label || fmt.ext).replace(/[<>:"/\\|?*]/g, '_').trim();
                const targetName = `${fallbackFileBase} [${cleanTag}].${fmt.ext}`;

                return (
                  <div
                    key={fmt.format_id}
                    className="p-2 bg-slate-50 dark:bg-[#111722] border border-slate-300 dark:border-[#232f42] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 bg-slate-200 dark:bg-[#1a2332] border border-slate-300 dark:border-[#2a3649] flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                        {fmt.is_audio_only ? (
                          <Music className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                        ) : (
                          <Film className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs" title={targetName}>
                          {targetName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="font-bold text-blue-800 dark:text-blue-400">{fmt.quality_label}</span>
                          <span>•</span>
                          <span className="uppercase font-mono">{fmt.ext}</span>
                          {fmt.resolution && <span>• {fmt.resolution}</span>}
                        </div>
                      </div>
                    </div>

                    {fmt.filesize_approx ? (
                      <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                        ~{formatBytes(fmt.filesize_approx)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Do Not Show Again Checkbox */}
          <label className="flex items-center gap-2.5 p-2 bg-slate-200/60 dark:bg-[#111722] border border-slate-300 dark:border-[#232f42] hover:bg-slate-200 dark:hover:bg-[#17202f] transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded-none border-slate-400 dark:border-slate-600 focus:ring-0 cursor-pointer accent-blue-600"
            />
            <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
              {t('multiFormat.dontShowAgain')}
            </span>
          </label>
        </div>

        {/* Win32 Footer Actions */}
        <div className="px-4 py-2 border-t border-slate-300 dark:border-[#202b3d] bg-slate-200 dark:bg-[#0f1520] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-4 py-1.5 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-300 dark:hover:bg-[#28354c] disabled:opacity-50 border border-slate-400 dark:border-[#384761] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-sm active:shadow-inner cursor-pointer transition-colors"
          >
            {t('multiFormat.cancel')}
          </button>
          <button
            type="button"
            disabled={isStarting}
            onClick={() => onConfirm(dontShowAgain)}
            className="px-5 py-1.5 bg-[#1a365d] hover:bg-[#152e4d] dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm active:shadow-inner flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>{t('multiFormat.starting')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-cyan-300" />
                <span>{t('multiFormat.continue', { count: selectedFormats.length })}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

