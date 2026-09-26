import { useState, useEffect } from 'react';
import {
  X,
  Download,
  Loader2,
  AlertTriangle,
  Layers,
  Sparkles,
  ClipboardPaste,
  ShieldCheck,
  Zap,
  Film,
  Clock,
  CheckCircle2,
  DownloadCloud,
  Images,
  CheckSquare,
  FolderPlus,
  Folder,
} from 'lucide-react';
import { ExtractorStatus, MediaFormatOption, ProbeResult } from '../types/download';
import { formatBytes } from '../utils/formatters';
import {
  probeUrl,
  getDefaultDirectory,
  checkExtractorStatus,
  installExtractor,
} from '../services/downloadApi';
import { cn } from '../utils/cn';

interface NewDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDownload: (params: {
    url: string;
    destinationPath?: string;
    fileName?: string;
    connections: number;
    formatId?: string;
    resolution?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
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
  onStartDownload,
}) => {
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [savePath, setSavePath] = useState('');
  const [connections, setConnections] = useState<number>(4);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Multimedia extractor states
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [extractorStatus, setExtractorStatus] = useState<ExtractorStatus | null>(null);
  const [installingExtractor, setInstallingExtractor] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Gallery states
  const [selectedImageIndices, setSelectedImageIndices] = useState<Set<number>>(new Set());
  const [folderOrganization, setFolderOrganization] = useState<'subfolder' | 'loose'>('subfolder');
  const [activeTab, setActiveTab] = useState<'video' | 'gallery'>('video');

  // Initialize and check clipboard on open
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setFileName('');
      setProbeResult(null);
      setProbeError(null);
      setStarting(false);
      setSelectedFormatId('');
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

    // Check clipboard for valid URL
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          setUrl(trimmed);
          handleProbe(trimmed);
        }
      } catch {
        // Clipboard read permission might be denied or unsupported; ignore quietly
      }
    };

    checkClipboard();
  }, [isOpen]);

  const handleProbe = async (urlToProbe: string) => {
    const targetUrl = urlToProbe.trim();
    if (!targetUrl) return;

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
        setSelectedFormatId(defaultFmt.format_id);
        setConnections(4);

        if (res.media_info.is_animated_gif && defaultFmt.ext === 'gif') {
          const dotIndex = initialFileName.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? initialFileName.substring(0, dotIndex) : initialFileName;
          initialFileName = `${baseName}.gif`;
        }
      } else if (res.suggested_connections) {
        setConnections(res.suggested_connections);
      } else if (!res.accept_ranges) {
        setConnections(1);
      }
      setFileName(initialFileName);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'No se pudo obtener información del enlace.';
      setProbeError(message);
    } finally {
      setProbing(false);
    }
  };

  const handleSelectFormat = (fmt: MediaFormatOption) => {
    setSelectedFormatId(fmt.format_id);

    // Update extension in filename
    if (fileName) {
      const dotIndex = fileName.lastIndexOf('.');
      const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
      setFileName(`${baseName}.${fmt.ext}`);
    }
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
          : 'Error descargando yt-dlp';
      setInstallError(msg);
    } finally {
      setInstallingExtractor(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) {
        setUrl(trimmed);
        handleProbe(trimmed);
      }
    } catch {
      // ignore
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
        // Clean and sanitize post title for filesystem folder and file naming
        const rawTitle = (media?.title || fileName || 'galeria_imagenes')
          .replace(/https?:\/\/\S+/g, '') // remove URLs
          .replace(/[\r\n\t]+/g, ' ') // replace newlines/tabs with space
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Windows invalid path chars
          .replace(/\s+/g, ' ') // collapse spaces
          .replace(/_+/g, '_') // collapse underscores
          .trim()
          .replace(/[. ]+$/, ''); // Windows forbids trailing dots or spaces

        const cleanTitle =
          (rawTitle.length > 60 ? rawTitle.slice(0, 60).trim().replace(/[. ]+$/, '') : rawTitle) ||
          'galeria';

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
            connections: connections || 4,
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
            : 'Error al descargar las imágenes de la galería';
        setProbeError(message);
      } finally {
        setStarting(false);
      }
      return;
    }

    // Video / Stream or Direct Download Mode
    setStarting(true);
    try {
      let chosenRes: string | undefined = undefined;
      if (media && selectedFormatId) {
        const fmt = media.formats.find((f) => f.format_id === selectedFormatId);
        if (fmt?.resolution) {
          chosenRes = fmt.resolution;
        }
      }

      await onStartDownload({
        url: url.trim(),
        destinationPath: savePath.trim() || undefined,
        fileName: fileName.trim() || undefined,
        connections: connections || 4,
        formatId: selectedFormatId || undefined,
        resolution: chosenRes,
        thumbnailUrl: media?.thumbnail_url || undefined,
        durationSeconds: media?.duration_seconds || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Error al iniciar la descarga';
      setProbeError(message);
    } finally {
      setStarting(false);
    }
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
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Nivel 1 • {platformDisplay}
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Nivel 2 • {platformDisplay}
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Nivel 3 • {platformDisplay}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            Multimedia • {platformDisplay}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]">
      <div className="relative w-full max-w-xl bg-slate-100 border border-slate-400 shadow-2xl text-slate-800 flex flex-col max-h-[92vh]">
        {/* Classic Win32 Dialog Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 flex items-center justify-between bg-[#1a365d] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-300" />
            <h2 className="text-xs font-bold uppercase tracking-wide">
              Nueva Descarga
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-red-600 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto text-xs">
          {/* URL Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Enlace de descarga o video (YouTube, X, Facebook, Reddit o directo):
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... o https://ejemplo.com/archivo.zip"
                className="flex-1 bg-white border border-slate-400 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Pegar enlace del portapapeles"
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-800 text-xs shadow-sm active:shadow-inner flex items-center gap-1 cursor-pointer shrink-0 font-medium"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-700" />
                <span>Pegar</span>
              </button>
              <button
                type="button"
                onClick={() => handleProbe(url)}
                disabled={!url.trim() || probing}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 border border-slate-400 text-slate-800 text-xs shadow-sm active:shadow-inner flex items-center gap-1 cursor-pointer shrink-0 font-medium"
              >
                {probing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>Inspeccionar</span>
              </button>
            </div>
          </div>

          {/* Probing Progress */}
          {probing && (
            <div className="p-2.5 bg-blue-50 border border-blue-300 flex items-center gap-2 text-xs text-blue-800 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analizando enlace, extrayendo metadatos y detectando formatos...</span>
            </div>
          )}

          {/* Error Message */}
          {probeError && (
            <div className="p-2.5 bg-red-50 border border-red-300 flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{probeError}</span>
            </div>
          )}

          {/* SOCIAL MEDIA / MULTIMEDIA CARD */}
          {media && !probing && (
            <div className="p-3 bg-white border border-slate-300 space-y-2.5 shadow-sm">
              {/* Media Header: Platform Level & Duration */}
              <div className="flex items-center justify-between">
                {getLevelBadge(media.platform_level, media.platform_display)}

                {media.duration_seconds ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 border border-slate-300">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatDuration(media.duration_seconds)}
                  </span>
                ) : null}
              </div>

              {/* Video Preview: Thumbnail & Title */}
              <div className="flex items-start gap-2.5">
                {media.thumbnail_url ? (
                  <div className="relative w-24 h-16 border border-slate-300 bg-slate-100 overflow-hidden shrink-0">
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
                  <div className="w-12 h-12 bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0 text-slate-600">
                    <Film className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4
                    className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight"
                    title={media.title}
                  >
                    {media.title}
                  </h4>
                  {media.uploader && (
                    <p className="text-[11px] text-slate-600 mt-1 truncate">
                      Canal / Autor:{' '}
                      <span className="text-blue-800 font-semibold">
                        {media.uploader}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Twitter / X Animated GIF Banner */}
              {media.is_animated_gif && (
                <div className="p-2.5 bg-pink-50 border border-pink-300 flex items-start gap-2 text-xs">
                  <Sparkles className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-pink-900 flex items-center gap-1.5">
                      <span>GIF Animado detectado</span>
                      <span className="text-[10px] font-mono uppercase px-1 py-0.2 bg-pink-200 text-pink-800 border border-pink-300">
                        Twitter / X
                      </span>
                    </div>
                    <div className="text-slate-700 mt-0.5 text-[11px]">
                      Puedes descargarlo como una animación <strong>.gif</strong> real optimizada o como video <strong>.mp4</strong> en bucle.
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
                        ? 'bg-[#cce8ff] border-blue-500 text-blue-900 shadow-sm'
                        : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    <Images className="w-3.5 h-3.5" />
                    <span>Galería de imágenes ({gallery.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('video')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border transition-all cursor-pointer',
                      activeTab === 'video'
                        ? 'bg-[#cce8ff] border-blue-500 text-blue-900 shadow-sm'
                        : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video / Stream ({media.formats.length} calidades)</span>
                  </button>
                </div>
              )}

              {/* GALLERY VIEW: Multiple images in Twitter, Reddit, etc. */}
              {isGalleryMode && gallery.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Images className="w-3.5 h-3.5 text-slate-600" />
                      <span>Imágenes encontradas ({gallery.length}):</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllImages}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-blue-800 border border-slate-400 cursor-pointer shadow-sm active:bg-slate-300"
                      >
                        Seleccionar todas
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllImages}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-400 cursor-pointer shadow-sm active:bg-slate-300"
                      >
                        Deseleccionar
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
                            'relative group border cursor-pointer transition-all aspect-video flex flex-col justify-between bg-slate-100 overflow-hidden',
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/40 shadow-sm'
                              : 'border-slate-300 opacity-70 hover:opacity-100 hover:border-slate-400'
                          )}
                        >
                          <img
                            src={item.thumbnail_url || item.url}
                            alt={`Imagen ${idx + 1}`}
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
                                  : 'bg-white/80 border-slate-500 text-transparent'
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
                    <div className="p-2.5 bg-slate-50 border border-slate-300 space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <FolderPlus className="w-3.5 h-3.5 text-slate-600" />
                        <span>¿Cómo guardar las imágenes?</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setFolderOrganization('subfolder')}
                          className={cn(
                            'p-2 border text-left flex items-start gap-2 transition-all cursor-pointer',
                            folderOrganization === 'subfolder'
                              ? 'bg-[#cce8ff] border-blue-500 text-blue-950 font-medium'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          <FolderPlus className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900">
                              Crear una subcarpeta (Recomendado)
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Crea una carpeta con el título de la publicación para contener las fotos
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderOrganization('loose')}
                          className={cn(
                            'p-2 border text-left flex items-start gap-2 transition-all cursor-pointer',
                            folderOrganization === 'loose'
                              ? 'bg-[#cce8ff] border-blue-500 text-blue-950 font-medium'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          <Folder className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900">
                              Guardar imágenes sueltas
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                              Descarga las fotos directamente en la carpeta de destino
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIDEO FORMAT SELECTION */}
              {!isGalleryMode && (
                <div className="space-y-1.5 pt-2 border-t border-slate-300">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Seleccionar Calidad y Formato:</span>
                    <span className="text-[11px] text-blue-700 font-mono font-semibold">
                      {media.formats.length} opciones disponibles
                    </span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {media.formats.map((fmt) => {
                      const isSelected = selectedFormatId === fmt.format_id;
                      return (
                        <button
                          type="button"
                          key={fmt.format_id}
                          onClick={() => handleSelectFormat(fmt)}
                          className={cn(
                            'p-1.5 text-left border transition-all cursor-pointer flex flex-col justify-between gap-1',
                            isSelected
                              ? 'bg-[#cce8ff] border-blue-500 text-blue-900 shadow-sm'
                              : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-800'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold truncate">
                              {fmt.quality_label}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-mono px-1 py-0.2 uppercase border font-semibold',
                                fmt.is_audio_only
                                  ? 'bg-pink-100 text-pink-800 border-pink-300'
                                  : 'bg-slate-200 text-slate-800 border-slate-300'
                              )}
                            >
                              {fmt.ext}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                            <span>
                              {fmt.resolution || (fmt.is_audio_only ? 'Audio' : 'Video')}
                            </span>
                            {fmt.filesize_approx && (
                              <span className="font-semibold text-slate-800">
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
                <div className="p-2.5 bg-amber-50 border border-amber-300 space-y-1.5 text-xs text-amber-900">
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Se requiere el motor <strong>yt-dlp</strong> para ensamblar streams de audio/video.
                    </span>
                  </div>

                  {installError && (
                    <div className="text-[11px] text-red-600 font-semibold">
                      {installError}
                    </div>
                  )}

                  {installSuccess ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ¡yt-dlp instalado y configurado correctamente!
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
                          ? 'Descargando motor yt-dlp...'
                          : 'Instalar yt-dlp automáticamente'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Advisory if FFmpeg is not installed */}
              {!isGalleryMode && extractorStatus && extractorStatus.ytdlp_installed && !extractorStatus.ffmpeg_installed && (
                <div className="p-2 bg-slate-50 border border-slate-300 flex items-start gap-1.5 text-[11px] text-slate-600">
                  <span className="px-1 py-0.2 bg-amber-100 text-amber-800 font-mono text-[10px] font-semibold shrink-0 border border-amber-300">
                    FFmpeg
                  </span>
                  <span>
                    No se detectó FFmpeg en el sistema. Se usará el stream de mayor calidad directa sin remuxing.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STANDARD HTTP PROBE RESULT CARD (NON-MEDIA) */}
          {probeResult && !media && !probing && (
            <div className="p-2.5 bg-white border border-slate-300 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tamaño detectado:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatBytes(probeResult.content_length)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Aceleración multihilo:</span>
                {probeResult.accept_ranges ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Soportada (Accept-Ranges)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Descarga en hilo único
                  </span>
                )}
              </div>

              {probeResult.content_type && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tipo de contenido:</span>
                  <span className="font-mono text-slate-700 text-[11px]">
                    {probeResult.content_type}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Connection Threads Selector */}
          <div className="p-2.5 bg-white border border-slate-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  {media && !isGalleryMode
                    ? 'Hilos de Descarga / Fragmentos concurrentes:'
                    : 'Conexiones simultáneas (Hilos de descarga):'}
                </span>
              </label>
              <span className="text-xs font-mono text-blue-900 font-bold">
                {connections} {connections === 1 ? 'hilo' : 'hilos'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[1, 4, 8, 16, 32].map((num) => {
                const disabled = Boolean(
                  probeResult && !media && !probeResult.accept_ranges && num > 1
                );
                return (
                  <button
                    type="button"
                    key={num}
                    disabled={disabled}
                    onClick={() => setConnections(num)}
                    title={
                      disabled
                        ? 'El servidor no admite descargas en múltiples conexiones'
                        : undefined
                    }
                    className={cn(
                      'py-1 px-2 text-xs font-mono font-semibold border transition-all cursor-pointer shadow-sm',
                      connections === num
                        ? 'bg-[#cce8ff] text-blue-900 border-blue-500 font-bold'
                        : 'bg-slate-100 text-slate-700 border-slate-400 hover:bg-slate-200 active:bg-slate-300',
                      disabled &&
                        'opacity-40 cursor-not-allowed hover:bg-slate-100 text-slate-400 border-slate-300'
                    )}
                  >
                    {num}x
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              {media && !isGalleryMode
                ? 'BundleRock acelera la descarga de fragmentos DASH/HLS concurrentemente con yt-dlp.'
                : probeResult && !probeResult.accept_ranges
                ? 'El servidor solo permite 1 conexión (sin soporte Accept-Ranges).'
                : 'BundleRock divide dinámicamente la descarga en segmentos para maximizar el ancho de banda.'}
            </p>
          </div>

          {/* File Name Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Nombre de archivo / Publicación:
            </label>
            {isGalleryMode ? (
              <p className="text-[11px] text-slate-600 bg-white p-2 border border-slate-300">
                Las {selectedImageIndices.size} imágenes seleccionadas se guardarán numeradas como:{' '}
                <code className="text-blue-900 font-mono font-semibold">
                  {(fileName || 'imagen').split('.')[0]}_1.jpg
                </code>
                ,{' '}
                <code className="text-blue-900 font-mono font-semibold">
                  {(fileName || 'imagen').split('.')[0]}_2.jpg
                </code>
                ...
              </p>
            ) : (
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="nombre_de_archivo.ext (opcional, se auto-detecta)"
                className="w-full bg-white border border-slate-400 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
              />
            )}
          </div>

          {/* Save Directory */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Carpeta de destino:
            </label>
            <input
              type="text"
              value={savePath}
              onChange={(e) => setSavePath(e.target.value)}
              placeholder="Ruta de guardado (por defecto Descargas)"
              className="w-full bg-white border border-slate-400 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] font-mono"
            />
          </div>

          {/* Buttons Footer */}
          <div className="pt-2 border-t border-slate-300 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-800 text-xs font-semibold shadow-sm active:bg-slate-300 active:shadow-inner cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                !url.trim() ||
                starting ||
                (isGalleryMode && selectedImageIndices.size === 0)
              }
              className="px-5 py-1.5 bg-[#1a365d] hover:bg-[#152e4d] disabled:opacity-50 text-white text-xs font-bold shadow-sm active:shadow-inner flex items-center gap-1.5 cursor-pointer"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isGalleryMode ? (
                <Images className="w-4 h-4" />
              ) : media ? (
                <Film className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isGalleryMode
                  ? `Descargar ${selectedImageIndices.size} ${selectedImageIndices.size === 1 ? 'imagen' : 'imágenes'}`
                  : media
                  ? 'Descargar Video / Audio'
                  : 'Descargar Ahora'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
