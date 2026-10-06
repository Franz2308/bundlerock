import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, AlertCircle, X, ChevronDown, ChevronUp, Loader2, ArrowRight } from 'lucide-react';
import { UpdateInfo, UpdateProgressPayload, installUpdate, onUpdateProgress } from '../services/downloadApi';
import { useTranslation } from '../i18n';

interface UpdateBannerProps {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
  activeDownloadsCount: number;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  updateInfo,
  onDismiss,
  activeDownloadsCount,
}) => {
  const { t } = useTranslation();
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgressPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await onUpdateProgress((payload) => {
        setDownloadProgress(payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    setErrorMessage(null);
    try {
      await installUpdate();
    } catch (err: unknown) {
      console.error('Update installation failed:', err);
      setIsInstalling(false);
      setErrorMessage(typeof err === 'string' ? err : 'Error during update installation');
    }
  };

  const versionText = updateInfo.version || '';
  const formattedTitle = t('updater.newVersionAvailable').replace('{version}', versionText);

  return (
    <div className="w-full bg-slate-900 border-b border-sky-500/40 text-slate-100 shadow-md transition-all duration-200 z-30 select-none">
      <div className="max-w-7xl mx-auto px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30 flex-shrink-0">
            {isInstalling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : errorMessage ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 truncate">
            <span className="font-semibold text-white tracking-wide">{formattedTitle}</span>

            {activeDownloadsCount > 0 && !isInstalling && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {t('updater.activeDownloadsWarning')}
              </span>
            )}

            {updateInfo.body && (
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="text-sky-300 hover:text-sky-200 underline flex items-center gap-0.5 ml-1 transition-colors cursor-pointer"
              >
                {t('updater.viewReleaseNotes')}
                {showNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Center / Progress bar when downloading */}
        {isInstalling && downloadProgress && (
          <div className="flex-1 max-w-xs mx-2 flex items-center gap-2">
            <div className="flex-1 bg-slate-800 rounded-full h-2 border border-slate-700 overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-150 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, downloadProgress.percentage))}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-sky-300 font-semibold w-10 text-right">
              {downloadProgress.percentage.toFixed(0)}%
            </span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {errorMessage ? (
            <>
              <span className="text-rose-300 text-[11px] max-w-[200px] truncate" title={errorMessage}>
                {errorMessage}
              </span>
              <button
                type="button"
                onClick={handleInstall}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3 h-3" />
                {t('updater.retry')}
              </button>
            </>
          ) : isInstalling ? (
            <span className="text-sky-300 text-xs flex items-center gap-1 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('updater.downloadingUpdate')}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={handleInstall}
                className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
              >
                <ArrowRight className="w-3 h-3" />
                {t('updater.updateAndRestart')}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              >
                {t('updater.later')}
              </button>
            </>
          )}

          {!isInstalling && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              aria-label={t('updater.later')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable release notes */}
      {showNotes && updateInfo.body && (
        <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2.5 max-h-40 overflow-y-auto text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed custom-scrollbar">
          <div className="text-[11px] font-bold text-sky-400 mb-1 select-none">
            {t('updater.viewReleaseNotes')} (v{versionText})
          </div>
          {updateInfo.body}
        </div>
      )}
    </div>
  );
};
