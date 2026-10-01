import { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Loader2,
  AlertTriangle,
  Layers,
  Sparkles,
  ClipboardPaste,
  ShieldCheck,
  Search,
  Film,
  Clock,
  CheckCircle2,
  DownloadCloud,
  Images,
  CheckSquare,
  FolderPlus,
  Folder,
  FolderOpen,
  Check,
} from 'lucide-react';
import { ExtractorStatus, MediaFormatOption, ProbeResult } from '../types/download';
import { formatBytes } from '../utils/formatters';
import {
  probeUrl,
  cancelProbe,
  getDefaultDirectory,
  checkExtractorStatus,
  installExtractor,
  readClipboardText,
  selectFolder,
} from '../services/downloadApi';
import { cn } from '../utils/cn';
import { MultiFormatConfirmModal } from './MultiFormatConfirmModal';
import { useTranslation } from '../i18n';

interface NewDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultConnections: number;
  initialUrl?: string;
  onStartDownload: (params: {
    url: string;
    destinationPath?: string;
    fileName?: string;
    connections: number;
    formatId?: string;
    resolution?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    groupId?: string;
  }) => Promise<void>;
}

function formatDuration(secs?: number | null): string {
  if (!secs || secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h > 0) {
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${remM}:${s.toString().padStart(2, '0')}`;
}

export const NewDownloadModal: React.FC<NewDownloadModalProps> = ({
  isOpen,
  onClose,
  defaultConnections,
  initialUrl,
  onStartDownload,
}) => {
  const { t, language } = useTranslation();
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [savePath, setSavePath] = useState('');

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Multimedia extractor states
  const [selectedFormatIds, setSelectedFormatIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [extractorStatus, setExtractorStatus] = useState<ExtractorStatus | null>(null);
  const [installingExtractor, setInstallingExtractor] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Gallery states
  const [selectedImageIndices, setSelectedImageIndices] = useState<Set<number>>(new Set());
  const [folderOrganization, setFolderOrganization] = useState<'subfolder' | 'loose'>('subfolder');
  const [activeTab, setActiveTab] = useState<'video' | 'gallery'>('video');

  const lastProbedUrlRef = useRef<string>('');
  const probeTimeoutRef = useRef<number | null>(null);

  // Initialize and check clipboard on open
  useEffect(() => {
    if (!isOpen) {
      if (probeTimeoutRef.current) {
        clearTimeout(probeTimeoutRef.current);
        probeTimeoutRef.current = null;
      }
      cancelProbe().catch(() => {});
      lastProbedUrlRef.current = '';
      setUrl('');
      setFileName('');
      setProbeResult(null);
      setProbeError(null);
      setStarting(false);
      setSelectedFormatIds(new Set());
      setShowConfirmModal(false);
      setInstallSuccess(false);
      setInstallError(null);
      setSelectedImageIndices(new Set());
      setFolderOrganization('subfolder');
      setActiveTab('video');
      return;
    }

    // Load default directory
    getDefaultDirectory().then((dir) => {
      if (dir) setSavePath(dir);
    });

    // Check extractor status
    checkExtractorStatus()
      .then((status) => setExtractorStatus(status))
      .catch(() => {});

    // If initialUrl was provided (e.g. from browser extension), probe it directly
    if (initialUrl && (initialUrl.startsWith('http://') || initialUrl.startsWith('https://'))) {
      setUrl(initialUrl);
      handleProbe(initialUrl, true);
      return;
    }

    // Check clipboard for valid URL with debounce
    const checkClipboard = async () => {
      try {
        const text = await readClipboardText();
        const trimmed = (text || '').trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          setUrl(trimmed);
          if (probeTimeoutRef.current) clearTimeout(probeTimeoutRef.current);
          probeTimeoutRef.current = window.setTimeout(() => {
            handleProbe(trimmed);
          }, 250);
        }
      } catch (e) {
        console.warn('Clipboard read error:', e);
      }
    };

    checkClipboard();
  }, [isOpen, initialUrl]);

  const handleProbe = async (urlToProbe: string, force = false) => {
    const targetUrl = urlToProbe.trim();
    if (!targetUrl) return;

    if (!force && targetUrl === lastProbedUrlRef.current && probeResult) {
      return;
    }
    lastProbedUrlRef.current = targetUrl;

    if (probeTimeoutRef.current) {
      clearTimeout(probeTimeoutRef.current);
      probeTimeoutRef.current = null;
    }

    setProbing(true);
    setProbeError(null);

    try {
      const res = await probeUrl(targetUrl);
      setProbeResult(res);
      setFileName(res.file_name);

      const gallery = res.media_info?.gallery_items || [];

      if (gallery.length > 0) {
        setSelectedImageIndices(new Set(gallery.map((_, i) => i)));
        setActiveTab('gallery');
      } else {
        setSelectedImageIndices(new Set());
        setActiveTab('video');
      }

      let initialFileName = res.file_name;
      if (res.media_info && res.media_info.formats.length > 0) {
        // Select first format by default
        const defaultFmt = res.media_info.formats[0];
        setSelectedFormatIds(new Set([defaultFmt.format_id]));

        if (res.media_info.is_animated_gif && defaultFmt.ext === 'gif') {
          const dotIndex = initialFileName.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? initialFileName.substring(0, dotIndex) : initialFileName;
          initialFileName = `${baseName}.gif`;
        }
      }
      setFileName(initialFileName);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : t('newDownload.defaultProbeError');
      setProbeError(message);
    } finally {
      setProbing(false);
    }
  };

  const toggleSelectFormat = (fmt: MediaFormatOption) => {
    setSelectedFormatIds((prev) => {
      const next = new Set(prev);
      if (next.has(fmt.format_id)) {
        next.delete(fmt.format_id);
      } else {
        next.add(fmt.format_id);
      }

      if (next.size === 1) {
        const remainingId = Array.from(next)[0];
        const remainingFmt = probeResult?.media_info?.formats.find(
          (f) => f.format_id === remainingId
        );
        if (remainingFmt && fileName) {
          const dotIndex = fileName.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
          setFileName(`${baseName}.${remainingFmt.ext}`);
        }
      }

      return next;
    });
  };

  const selectAllFormats = () => {
    const formats = probeResult?.media_info?.formats || [];
    setSelectedFormatIds(new Set(formats.map((f) => f.format_id)));
  };

  const deselectAllFormats = () => {
    setSelectedFormatIds(new Set());
  };

  const toggleSelectImage = (index: number) => {
    setSelectedImageIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllImages = () => {
    const gallery = probeResult?.media_info?.gallery_items || [];
    setSelectedImageIndices(new Set(gallery.map((_, i) => i)));
  };

  const deselectAllImages = () => {
    setSelectedImageIndices(new Set());
  };

  const handleInstallExtractor = async () => {
    setInstallingExtractor(true);
    setInstallError(null);
    try {
      await installExtractor();
      setInstallSuccess(true);
      const status = await checkExtractorStatus();
      setExtractorStatus(status);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : t('newDownload.ytdlpInstallError');
      setInstallError(msg);
    } finally {
      setInstallingExtractor(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await readClipboardText();
      const trimmed = (text || '').trim();
      if (trimmed) {
        setUrl(trimmed);
        if (probeTimeoutRef.current) clearTimeout(probeTimeoutRef.current);
        probeTimeoutRef.current = window.setTimeout(() => {
          handleProbe(trimmed, true);
        }, 150);
      }
    } catch (e) {
      console.warn('Paste failed:', e);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await selectFolder(savePath.trim() || undefined);
      if (selected) {
        setSavePath(selected);
      }
    } catch (e) {
      console.warn('Folder selection failed:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || starting) return;

    const media = probeResult?.media_info;
    const gallery = media?.gallery_items || [];
    const isGalleryMode =
      gallery.length > 0 &&
      (activeTab === 'gallery' || !media?.formats || media.formats.length === 0);

    // Gallery Download Mode
    if (isGalleryMode) {
      if (selectedImageIndices.size === 0) return;
      setStarting(true);
      try {
        const baseDir = savePath.trim() || undefined;
        const fallbackGalleryTitle = language === 'es' ? 'galeria_imagenes' : 'image_gallery';
        const rawTitle = (media?.title || fileName || fallbackGalleryTitle)
          .replace(/https?:\/\/\S+/g, '') // remove URLs
          .replace(/[\r\n\t]+/g, ' ') // replace newlines/tabs with space
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Windows invalid path chars
          .replace(/\s+/g, ' ') // collapse spaces
          .replace(/_+/g, '_') // collapse underscores
          .trim()
          .replace(/[. ]+$/, ''); // Windows forbids trailing dots or spaces

        const cleanTitle =
          (rawTitle.length > 60 ? rawTitle.slice(0, 60).trim().replace(/[. ]+$/, '') : rawTitle) ||
          (language === 'es' ? 'galeria' : 'gallery');

        let targetDir = baseDir;
        if (folderOrganization === 'subfolder' && (gallery.length > 1 || selectedImageIndices.size > 1)) {
          targetDir = baseDir ? `${baseDir}/${cleanTitle}` : cleanTitle;
        }

        const selectedItems = gallery.filter((_, idx) => selectedImageIndices.has(idx));

        for (const item of selectedItems) {
          let ext = 'jpg';
          try {
            const u = new URL(item.url);
            const fmt = u.searchParams.get('format');
            if (fmt) {
              ext = fmt.toLowerCase();
            } else {
              const extMatch = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
              if (extMatch) {
                ext = extMatch[1].toLowerCase();
              }
            }
          } catch {
            ext = 'jpg';
          }

          const imgFileName = `${cleanTitle}_${item.index + 1}.${ext}`;
          const resStr =
            item.width && item.height ? `${item.width}x${item.height}` : undefined;

          await onStartDownload({
            url: item.url,
            destinationPath: targetDir,
            fileName: imgFileName,
            connections: (probeResult && !probeResult.media_info && !probeResult.accept_ranges) ? 1 : (defaultConnections || 4),
            resolution: resStr,
            thumbnailUrl: item.thumbnail_url || item.url,
          });
        }
        onClose();
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : t('newDownload.galleryError');
        setProbeError(message);
      } finally {
        setStarting(false);
      }
      return;
    }

    // Video / Stream Mode
    if (media && media.formats && media.formats.length > 0) {
      const selectedFormats = media.formats.filter((f) =>
        selectedFormatIds.has(f.format_id)
      );

      if (selectedFormats.length === 0) return;

      if (selectedFormats.length > 1) {
        const skip =
          typeof window !== 'undefined' &&
          localStorage.getItem('bundlerock_skip_multiformat_confirm') === 'true';
        if (!skip) {
          setShowConfirmModal(true);
          return;
        }
      }

      await executeVideoDownloads(selectedFormats);
      return;
    }

    // Standard Direct File Download Mode
    await executeVideoDownloads([]);
  };

  const executeVideoDownloads = async (formatsToDownload: MediaFormatOption[]) => {
    setStarting(true);
    try {
      const media = probeResult?.media_info;
      const userChosen = fileName.trim();
      const rawTitle = (userChosen || media?.title || 'video')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/_+/g, '_')
        .trim()
        .replace(/[. ]+$/, '');

      const dotIdx = rawTitle.lastIndexOf('.');
      const baseStem = (dotIdx !== -1 ? rawTitle.substring(0, dotIdx) : rawTitle) || 'video';

      if (formatsToDownload.length > 1) {
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const usedFileNames = new Set<string>();

        for (const fmt of formatsToDownload) {
          const cleanTag = (fmt.quality_label || fmt.ext).replace(/[<>:"/\\|?*]/g, '_').trim();
          let variantFileName = `${baseStem} [${cleanTag}].${fmt.ext}`;
          if (usedFileNames.has(variantFileName.toLowerCase())) {
            variantFileName = `${baseStem} [${cleanTag}_${fmt.format_id}].${fmt.ext}`;
          }
          usedFileNames.add(variantFileName.toLowerCase());

          await onStartDownload({
            url: url.trim(),
            destinationPath: savePath.trim() || undefined,
            fileName: variantFileName,
            connections: (probeResult && !probeResult.media_info && !probeResult.accept_ranges) ? 1 : (defaultConnections || 4),
            formatId: fmt.format_id,
            resolution: fmt.resolution || undefined,
            thumbnailUrl: media?.thumbnail_url || undefined,
            durationSeconds: media?.duration_seconds || undefined,
            groupId,
          });
        }
      } else if (formatsToDownload.length === 1) {
        const fmt = formatsToDownload[0];
        let chosenName = fileName.trim() || undefined;
        if (!chosenName) {
          chosenName = `${baseStem}.${fmt.ext}`;
        }
        await onStartDownload({
          url: url.trim(),
          destinationPath: savePath.trim() || undefined,
          fileName: chosenName,
          connections: (probeResult && !probeResult.media_info && !probeResult.accept_ranges) ? 1 : (defaultConnections || 4),
          formatId: fmt.format_id,
          resolution: fmt.resolution || undefined,
          thumbnailUrl: media?.thumbnail_url || undefined,
          durationSeconds: media?.duration_seconds || undefined,
        });
      } else {
        await onStartDownload({
          url: url.trim(),
          destinationPath: savePath.trim() || undefined,
          fileName: fileName.trim() || undefined,
          connections: (probeResult && !probeResult.media_info && !probeResult.accept_ranges) ? 1 : (defaultConnections || 4),
        });
      }

      setShowConfirmModal(false);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : t('newDownload.downloadError');
      setProbeError(message);
    } finally {
      setStarting(false);
    }
  };

  const handleConfirmMultiDownload = (dontShowAgain: boolean) => {
    if (starting) return;
    if (dontShowAgain) {
      try {
        localStorage.setItem('bundlerock_skip_multiformat_confirm', 'true');
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
    const media = probeResult?.media_info;
    const selectedFormats = media
      ? media.formats.filter((f) => selectedFormatIds.has(f.format_id))
      : [];
    executeVideoDownloads(selectedFormats);
  };

  if (!isOpen) return null;

  const media = probeResult?.media_info;
  const gallery = media?.gallery_items || [];
  const isGalleryMode =
    gallery.length > 0 &&
    (activeTab === 'gallery' || !media?.formats || media.formats.length === 0);

  // Platform badges with specific level styling
  const getLevelBadge = (level: number, platformDisplay: string) => {
    switch (level) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-50 dark:bg-rose-950/400"></span>
            {t('newDownload.level', { level, platform: platformDisplay })}
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-50 dark:bg-blue-950/400"></span>
            {t('newDownload.level', { level, platform: platformDisplay })}
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-50 dark:bg-amber-950/400"></span>
            {t('newDownload.level', { level, platform: platformDisplay })}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-50 dark:bg-purple-950/400"></span>
            {t('newDownload.multimedia', { platform: platformDisplay })}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-xl bg-slate-100 dark:bg-[#141b27] border border-slate-400 dark:border-[#2d3a4f] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col max-h-[88vh] my-auto">
        {/* Classic Win32 Dialog Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 dark:border-[#202b3d] flex items-center justify-between bg-[#1a365d] dark:bg-[#12233c] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-300" />
            <h2 className="text-xs font-bold uppercase tracking-wide">
              {t('newDownload.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 hover:bg-red-600 text-white transition-colors cursor-pointer"
            title={t('newDownload.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto text-xs flex-1 custom-scrollbar">
            {/* URL Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('newDownload.urlLabel')}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('newDownload.urlPlaceholder')}
                className="flex-1 bg-white dark:bg-[#1a2332] border border-slate-400 dark:border-[#384761] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
              />
              <button
                type="button"
                onClick={handlePaste}
                title={t('newDownload.pasteTooltip')}
                className="px-2.5 py-1.5 bg-slate-200 dark:bg-[#192231] hover:bg-slate-300 dark:hover:bg-[#222e42] border border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 text-xs shadow-sm active:shadow-inner flex items-center gap-1 cursor-pointer shrink-0 font-medium transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <span>{t('newDownload.paste')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleProbe(url, true)}
                disabled={!url.trim() || probing}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#192231] hover:bg-slate-200 dark:hover:bg-[#222e42] hover:border-slate-500 dark:hover:border-[#425470] disabled:opacity-50 border border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 text-xs shadow-xs active:shadow-inner active:bg-slate-300 dark:active:bg-[#2b3a52] flex items-center gap-1.5 cursor-pointer shrink-0 font-medium transition-colors rounded-xs"
                title={t('newDownload.inspectTooltip')}
              >
                {probing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                )}
                <span>{t('newDownload.inspect')}</span>
              </button>
            </div>
          </div>

          {/* Probing Progress */}
          {probing && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-400 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>{t('newDownload.probing')}</span>
            </div>
          )}

          {/* Error Message */}
          {probeError && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{probeError}</span>
            </div>
          )}

          {/* SOCIAL MEDIA / MULTIMEDIA CARD */}
          {media && !probing && (
            <div className="p-3 bg-white dark:bg-[#1a2332] border border-slate-300 dark:border-[#2d3a4f] space-y-2.5 shadow-sm">
              {/* Media Header: Platform Level & Duration */}
              <div className="flex items-center justify-between">
                {getLevelBadge(media.platform_level, media.platform_display)}

                {media.duration_seconds ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#141b27] px-2 py-0.5 border border-slate-300 dark:border-[#384761]">
                    <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    {formatDuration(media.duration_seconds)}
                  </span>
                ) : null}
              </div>

              {/* Video Preview: Thumbnail & Title */}
              <div className="flex items-start gap-2.5">
                {media.thumbnail_url ? (
                  <div className="relative w-24 h-16 border border-slate-300 dark:border-[#384761] bg-slate-100 dark:bg-[#141b27] overflow-hidden shrink-0">
                    <img
                      src={media.thumbnail_url}
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                      <Film className="w-4 h-4 text-white drop-shadow" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-slate-100 dark:bg-[#141b27] border border-slate-300 dark:border-[#384761] flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
                    <Film className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4
                    className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight"
                    title={media.title}
                  >
                    {media.title}
                  </h4>
                  {media.uploader && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate">
                      {t('newDownload.channelAuthor')}{' '}
                      <span className="text-blue-800 dark:text-blue-400 font-semibold">
                        {media.uploader}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Twitter / X Animated GIF Banner */}
              {media.is_animated_gif && (
                <div className="p-2.5 bg-pink-50 dark:bg-[#2c1320] border border-pink-300 dark:border-[#522538] flex items-start gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-pink-900 dark:text-pink-300 flex items-center gap-1.5">
                      <span>{t('newDownload.animatedGifDetected')}</span>
                      <span className="text-[10px] font-mono uppercase px-1 py-0.2 bg-pink-200 dark:bg-pink-900/50 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-[#73354f]">
                        Twitter / X
                      </span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 mt-0.5 text-[11px]">
                      {t('newDownload.animatedGifDesc')}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Selector if both Gallery and Video Formats exist */}
              {gallery.length > 0 && media.formats.length > 0 && (
                <div className="flex items-center gap-1 border-b border-slate-300 pb-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('gallery')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border transition-all cursor-pointer',
                      activeTab === 'gallery'
                        ? 'bg-[#cce8ff] dark:bg-[#1a365d] border-blue-500 text-blue-900 dark:text-blue-100 shadow-sm'
                        : 'bg-slate-100 dark:bg-[#192231] border-slate-300 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222e42]'
                    )}
                  >
                    <Images className="w-3.5 h-3.5" />
                    <span>{t('newDownload.galleryTab', { count: gallery.length })}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('video')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border transition-all cursor-pointer',
                      activeTab === 'video'
                        ? 'bg-[#cce8ff] dark:bg-[#1a365d] border-blue-500 text-blue-900 dark:text-blue-100 shadow-sm'
                        : 'bg-slate-100 dark:bg-[#192231] border-slate-300 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222e42]'
                    )}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>{t('newDownload.videoTab', { count: media.formats.length })}</span>
                  </button>
                </div>
              )}

              {/* GALLERY VIEW: Multiple images in Twitter, Reddit, etc. */}
              {isGalleryMode && gallery.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Images className="w-3.5 h-3.5 text-slate-600" />
                      <span>{t('newDownload.imagesFound', { count: gallery.length })}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllImages}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#222e42] text-blue-800 dark:text-blue-400 border border-slate-400 dark:border-[#384761] cursor-pointer shadow-sm active:bg-slate-300 dark:active:bg-[#2a3850]"
                      >
                        {t('newDownload.selectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllImages}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#222e42] text-slate-700 dark:text-slate-300 border border-slate-400 dark:border-[#384761] cursor-pointer shadow-sm active:bg-slate-300 dark:active:bg-[#2a3850]"
                      >
                        {t('newDownload.deselectAll')}
                      </button>
                    </div>
                  </div>

                  {/* Image Grid with Thumbnails and Checkboxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                    {gallery.map((item, idx) => {
                      const isSelected = selectedImageIndices.has(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleSelectImage(idx)}
                          className={cn(
                            'relative group border cursor-pointer transition-all aspect-video flex flex-col justify-between bg-slate-100 dark:bg-[#1a2332] overflow-hidden',
                            isSelected
                              ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/40 shadow-sm'
                              : 'border-slate-300 dark:border-[#384761] opacity-70 hover:opacity-100 hover:border-slate-400 dark:hover:border-[#4b5b75]'
                          )}
                        >
                          <img
                            src={item.thumbnail_url || item.url}
                            alt={t('newDownload.imageAlt', { index: idx + 1 })}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                          {/* Checkbox badge top right */}
                          <div className="absolute top-1.5 right-1.5 pointer-events-none">
                            <div
                              className={cn(
                                'w-4 h-4 rounded-sm flex items-center justify-center border transition-all',
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow'
                                  : 'bg-white/80 dark:bg-black/50 border-slate-500 dark:border-slate-400 text-transparent'
                              )}
                            >
                              <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          </div>

                          {/* Bottom metadata */}
                          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-mono text-white">
                            <span className="font-bold bg-black/60 px-1 py-0.2 rounded">
                              #{idx + 1}
                            </span>
                            {item.width && item.height && (
                              <span className="bg-black/60 px-1 py-0.2 rounded text-cyan-200">
                                {item.width}x{item.height}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Organization option: Subfolder vs Loose */}
                  {gallery.length > 1 && (
                    <div className="p-2.5 bg-slate-50 dark:bg-[#192231] border border-slate-300 dark:border-[#384761] space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <FolderPlus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        <span>{t('newDownload.howToSave')}</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setFolderOrganization('subfolder')}
                          className={cn(
                            'p-2 border text-left flex items-start gap-2 transition-all cursor-pointer',
                            folderOrganization === 'subfolder'
                              ? 'bg-[#cce8ff] dark:bg-[#1a365d] border-blue-500 text-blue-950 dark:text-blue-100 font-medium'
                              : 'bg-white dark:bg-[#1a2332] border-slate-300 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222e42]'
                          )}
                        >
                          <FolderPlus className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-200">
                              {t('newDownload.createSubfolder')}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                              {t('newDownload.createSubfolderDesc')}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderOrganization('loose')}
                          className={cn(
                            'p-2 border text-left flex items-start gap-2 transition-all cursor-pointer',
                            folderOrganization === 'loose'
                              ? 'bg-[#cce8ff] dark:bg-[#1a365d] border-blue-500 text-blue-950 dark:text-blue-100 font-medium'
                              : 'bg-white dark:bg-[#1a2332] border-slate-300 dark:border-[#384761] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222e42]'
                          )}
                        >
                          <Folder className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-200">
                              {t('newDownload.saveLoose')}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                              {t('newDownload.saveLooseDesc')}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIDEO FORMAT SELECTION (MULTI-SELECT) */}
              {!isGalleryMode && (
                <div className="space-y-1.5 pt-2 border-t border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-slate-600" />
                      <span>{t('newDownload.selectQualities')}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-blue-700 dark:text-blue-400 font-mono font-semibold mr-1">
                        {t('newDownload.selectedCount', {
                          selected: selectedFormatIds.size,
                          total: media.formats.length,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={selectAllFormats}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#222e42] text-blue-800 dark:text-blue-400 border border-slate-400 dark:border-[#384761] cursor-pointer shadow-sm active:bg-slate-300 dark:active:bg-[#2a3850]"
                      >
                        {t('newDownload.selectAllFormats')}
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllFormats}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-[#1a2332] hover:bg-slate-200 dark:hover:bg-[#222e42] text-slate-700 dark:text-slate-300 border border-slate-400 dark:border-[#384761] cursor-pointer shadow-sm active:bg-slate-300 dark:active:bg-[#2a3850]"
                      >
                        {t('newDownload.deselectAll')}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {media.formats.map((fmt) => {
                      const isSelected = selectedFormatIds.has(fmt.format_id);
                      return (
                        <button
                          type="button"
                          key={fmt.format_id}
                          onClick={() => toggleSelectFormat(fmt)}
                          className={cn(
                            'p-2 text-left border transition-all cursor-pointer flex flex-col justify-between gap-1.5',
                            isSelected
                              ? 'bg-[#cce8ff] dark:bg-[#1a365d] border-blue-600 dark:border-blue-500 text-blue-950 dark:text-blue-100 font-medium shadow-sm ring-1 ring-blue-500/50'
                              : 'bg-slate-50 dark:bg-[#192231] border-slate-300 dark:border-[#384761] hover:bg-slate-100 dark:hover:bg-[#222e42] text-slate-800 dark:text-slate-200'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={cn(
                                  'w-3.5 h-3.5 border flex items-center justify-center transition-all shrink-0',
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-[#1a2332] border-slate-400 dark:border-[#425470] text-transparent'
                                )}
                              >
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-xs font-bold truncate">
                                {fmt.quality_label}
                              </span>
                            </div>
                            <span
                              className={cn(
                                'text-[9px] font-mono px-1 py-0.2 uppercase border font-semibold shrink-0',
                                fmt.is_audio_only
                                  ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-800'
                                  : 'bg-slate-200 dark:bg-[#1c2536] text-slate-800 dark:text-slate-300 border-slate-300 dark:border-[#384761]'
                              )}
                            >
                              {fmt.ext}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 font-mono pl-5">
                            <span>
                              {fmt.resolution || (fmt.is_audio_only ? t('newDownload.audio') : t('newDownload.video'))}
                            </span>
                            {fmt.filesize_approx && (
                              <span className="font-semibold text-slate-800 dark:text-slate-300">
                                ~{formatBytes(fmt.filesize_approx)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notice if yt-dlp is missing */}
              {!isGalleryMode && extractorStatus && !extractorStatus.ytdlp_installed && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {t('newDownload.ytdlpRequired')}
                    </span>
                  </div>

                  {installError && (
                    <div className="text-[11px] text-red-600 font-semibold">
                      {installError}
                    </div>
                  )}

                  {installSuccess ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {t('newDownload.ytdlpSuccess')}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstallExtractor}
                      disabled={installingExtractor}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:shadow-inner cursor-pointer disabled:opacity-50"
                    >
                      {installingExtractor ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <DownloadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {installingExtractor
                          ? t('newDownload.downloadingYtdlp')
                          : t('newDownload.installYtdlpAuto')}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Advisory if FFmpeg is not installed */}
              {!isGalleryMode && extractorStatus && extractorStatus.ytdlp_installed && !extractorStatus.ffmpeg_installed && (
                <div className="p-2 bg-slate-50 dark:bg-[#192231] border border-slate-300 dark:border-[#384761] flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="px-1 py-0.2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 font-mono text-[10px] font-semibold shrink-0 border border-amber-300 dark:border-amber-700">
                    FFmpeg
                  </span>
                  <span>
                    {t('newDownload.ffmpegNotice')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STANDARD HTTP PROBE RESULT CARD (NON-MEDIA) */}
          {probeResult && !media && !probing && (
            <div className="p-2.5 bg-white dark:bg-[#1a2332] border border-slate-300 dark:border-[#2d3a4f] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t('newDownload.detectedSize')}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                  {formatBytes(probeResult.content_length)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">{t('newDownload.multithreadAccel')}</span>
                {probeResult.accept_ranges ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {t('newDownload.supportedRanges')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    {t('newDownload.singleThread')}
                  </span>
                )}
              </div>

              {probeResult.content_type && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{t('newDownload.contentType')}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                    {probeResult.content_type}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* File Name Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('newDownload.fileNameLabel')}
            </label>
            {isGalleryMode ? (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-[#1a2332] p-2 border border-slate-300 dark:border-[#384761]">
                {t('newDownload.galleryNotice', { count: selectedImageIndices.size })}{' '}
                <code className="text-blue-900 dark:text-blue-400 font-mono font-semibold">
                  {(fileName || (language === 'es' ? 'imagen' : 'image')).split('.')[0]}_1.jpg
                </code>
                ,{' '}
                <code className="text-blue-900 dark:text-blue-400 font-mono font-semibold">
                  {(fileName || (language === 'es' ? 'imagen' : 'image')).split('.')[0]}_2.jpg
                </code>
                ...
              </p>
            ) : (
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={t('newDownload.fileNamePlaceholder')}
                className="w-full bg-white dark:bg-[#1a2332] border border-slate-400 dark:border-[#384761] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
              />
            )}
          </div>

          {/* Save Directory */}
          <div className="space-y-1 pb-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('newDownload.destinationFolder')}
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder={t('newDownload.destinationPlaceholder')}
                className="flex-1 bg-white dark:bg-[#1a2332] border border-slate-400 dark:border-[#384761] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                title={t('newDownload.browseTooltip')}
                className="px-2.5 py-1.5 bg-slate-200 dark:bg-[#192231] hover:bg-slate-300 dark:hover:bg-[#222e42] border border-slate-400 dark:border-[#303f56] text-slate-800 dark:text-slate-200 text-xs shadow-sm active:shadow-inner flex items-center gap-1.5 cursor-pointer shrink-0 font-medium transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                <span>{t('newDownload.browseFolder')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Buttons Footer (Cleanly separated from scrollable content) */}
        <div className="px-3 sm:px-4 py-2.5 border-t border-slate-300 dark:border-[#202b3d] bg-slate-200 dark:bg-[#0f1520] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-300 dark:hover:bg-[#28354c] border border-slate-400 dark:border-[#384761] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs active:bg-slate-300 dark:active:bg-[#32435f] active:shadow-inner cursor-pointer rounded-xs transition-colors"
          >
            {t('newDownload.cancel')}
          </button>
          <button
            type="submit"
            disabled={
              Boolean(
                !url.trim() ||
                starting ||
                (isGalleryMode && selectedImageIndices.size === 0) ||
                (media && !isGalleryMode && selectedFormatIds.size === 0)
              )
            }
            className="px-5 py-1.5 bg-[#1a365d] hover:bg-[#152e4d] dark:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm active:shadow-inner flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            ) : isGalleryMode ? (
              <Images className="w-4 h-4 text-cyan-300" />
            ) : media ? (
              <Film className="w-4 h-4 text-cyan-300" />
            ) : (
              <Download className="w-4 h-4 text-cyan-300" />
            )}
            <span>
              {isGalleryMode
                ? selectedImageIndices.size === 1
                  ? t('newDownload.downloadImagesSingular')
                  : t('newDownload.downloadImagesPlural', { count: selectedImageIndices.size })
                : media
                ? selectedFormatIds.size > 1
                  ? t('newDownload.downloadFormats', { count: selectedFormatIds.size })
                  : t('newDownload.downloadVideoAudio')
                : t('newDownload.downloadNow')}
            </span>
          </button>
        </div>
      </form>
      </div>

      {/* Multi-Format Warning & Confirmation Modal */}
      <MultiFormatConfirmModal
        isOpen={showConfirmModal}
        onClose={() => !starting && setShowConfirmModal(false)}
        onConfirm={handleConfirmMultiDownload}
        isStarting={starting}
        selectedFormats={
          media
            ? media.formats.filter((f) => selectedFormatIds.has(f.format_id))
            : []
        }
        fileNameBase={
          (fileName.trim() || media?.title || (language === 'es' ? 'archivo' : 'file'))
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\.[^/.]+$/, '')
            .trim() || (language === 'es' ? 'archivo' : 'file')
        }
      />
    </div>
  );
};
