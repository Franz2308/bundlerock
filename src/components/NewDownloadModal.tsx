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
  const [connections, setConnections] = useState<number>(16);
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

      if (res.media_info && res.media_info.formats.length > 0) {
        // Select first format by default
        const defaultFmt = res.media_info.formats[0];
        setSelectedFormatId(defaultFmt.format_id);
        setConnections(4);
      } else if (res.suggested_connections) {
        setConnections(res.suggested_connections);
      } else if (!res.accept_ranges) {
        setConnections(1);
      }
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

    setStarting(true);
    try {
      await onStartDownload({
        url: url.trim(),
        destinationPath: savePath.trim() || undefined,
        fileName: fileName.trim() || undefined,
        connections: connections || 16,
        formatId: selectedFormatId || undefined,
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

  // Platform badges with specific level styling
  const getLevelBadge = (level: number, platformDisplay: string) => {
    switch (level) {
      case 1:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Nivel 1 • {platformDisplay}
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Nivel 2 • {platformDisplay}
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Nivel 3 • {platformDisplay}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Multimedia • {platformDisplay}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5 fill-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Nueva Descarga
              </h2>
              <p className="text-xs text-slate-400">
                Aceleración multihilo y extracción de redes sociales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Enlace de descarga o video (YouTube, X, Facebook, Reddit o directo)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... o https://ejemplo.com/archivo.zip"
                className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Pegar enlace del portapapeles"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleProbe(url)}
                disabled={!url.trim() || probing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {probing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Inspeccionar</span>
              </button>
            </div>
          </div>

          {/* Probing Progress */}
          {probing && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-500/20 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-300">
                Analizando enlace, extrayendo metadatos y detectando formatos...
              </span>
            </div>
          )}

          {/* Error Message */}
          {probeError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{probeError}</span>
            </div>
          )}

          {/* SOCIAL MEDIA / MULTIMEDIA CARD */}
          {media && !probing && (
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3.5 shadow-lg shadow-cyan-950/20 animate-in fade-in zoom-in-95">
              {/* Media Header: Platform Level & Duration */}
              <div className="flex items-center justify-between">
                {getLevelBadge(media.platform_level, media.platform_display)}

                {media.duration_seconds ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    {formatDuration(media.duration_seconds)}
                  </span>
                ) : null}
              </div>

              {/* Video Preview: Thumbnail & Title */}
              <div className="flex items-start gap-3">
                {media.thumbnail_url ? (
                  <div className="relative w-28 h-18 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-900 shadow">
                    <img
                      src={media.thumbnail_url}
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Film className="w-4 h-4 text-white/80 drop-shadow" />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 text-cyan-400">
                    <Film className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4
                    className="text-xs font-bold text-slate-100 line-clamp-2 leading-relaxed"
                    title={media.title}
                  >
                    {media.title}
                  </h4>
                  {media.uploader && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      Canal / Autor:{' '}
                      <span className="text-cyan-300 font-medium">
                        {media.uploader}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Quality & Format Selection Grid */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Seleccionar Calidad y Formato:</span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {media.formats.length} opciones disponibles
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {media.formats.map((fmt) => {
                    const isSelected = selectedFormatId === fmt.format_id;
                    return (
                      <button
                        type="button"
                        key={fmt.format_id}
                        onClick={() => handleSelectFormat(fmt)}
                        className={cn(
                          'p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-1',
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-500/20 text-slate-100'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/40'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">
                            {fmt.quality_label}
                          </span>
                          <span
                            className={cn(
                              'text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase',
                              fmt.is_audio_only
                                ? 'bg-pink-950 text-pink-300 border border-pink-800/60'
                                : 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                            )}
                          >
                            {fmt.ext}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>
                            {fmt.resolution || (fmt.is_audio_only ? 'Audio' : 'Video')}
                          </span>
                          {fmt.filesize_approx && (
                            <span className="text-slate-300 font-medium">
                              ~{formatBytes(fmt.filesize_approx)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notice if yt-dlp is missing */}
              {extractorStatus && !extractorStatus.ytdlp_installed && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Se requiere el motor multimedia <strong>yt-dlp</strong> para
                      procesar y ensamblar streams de audio/video.
                    </span>
                  </div>

                  {installError && (
                    <div className="text-[11px] text-rose-300">
                      {installError}
                    </div>
                  )}

                  {installSuccess ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ¡yt-dlp instalado y configurado correctamente!
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstallExtractor}
                      disabled={installingExtractor}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
              {extractorStatus && extractorStatus.ytdlp_installed && !extractorStatus.ffmpeg_installed && (
                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-start gap-2 text-[11px] text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] font-semibold shrink-0 border border-amber-500/30">
                    FFmpeg
                  </span>
                  <span>
                    No se detectó FFmpeg en el sistema. BundleRock usará el stream de mayor calidad directa sin remuxing. Para ensamblar pistas 1080p+ y audio MP3 sin pérdida, se recomienda contar con FFmpeg.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STANDARD HTTP PROBE RESULT CARD (NON-MEDIA) */}
          {probeResult && !media && !probing && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Tamaño detectado:</span>
                <span className="font-mono font-bold text-slate-100">
                  {formatBytes(probeResult.content_length)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Aceleración multihilo:</span>
                {probeResult.accept_ranges ? (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
                    <ShieldCheck className="w-3 h-3" />
                    Soportada (Accept-Ranges)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/80">
                    <AlertTriangle className="w-3 h-3" />
                    Descarga en hilo único
                  </span>
                )}
              </div>

              {probeResult.content_type && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Tipo de contenido:</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {probeResult.content_type}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* File Name Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Nombre de archivo a guardar
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="nombre_de_archivo.ext (opcional, se auto-detecta)"
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Save Directory */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Carpeta de destino
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder="Ruta de guardado (por defecto Descargas)"
                className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Connection Threads Selector (for direct downloads) */}
          {!media && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Conexiones simultáneas (Hilos)
                </label>
                <span className="text-xs font-mono text-cyan-300 font-bold">
                  {connections} {connections === 1 ? 'conexión' : 'conexiones'}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 4, 8, 16, 32].map((num) => {
                  const disabled = Boolean(
                    probeResult && !probeResult.accept_ranges && num > 1
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
                        'py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer',
                        connections === num
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                          : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200',
                        disabled &&
                          'opacity-40 cursor-not-allowed hover:border-slate-800 hover:text-slate-400'
                      )}
                    >
                      {num}x
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                {probeResult && !probeResult.accept_ranges
                  ? 'El servidor solo permite 1 conexión (sin soporte Accept-Ranges).'
                  : 'BundleRock divide dinámicamente el archivo en segmentos para maximizar el ancho de banda.'}
              </p>
            </div>
          )}

          {/* Buttons Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!url.trim() || starting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              {starting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : media ? (
                <Film className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <Download className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>
                {media ? 'Descargar Video / Audio' : 'Descargar Ahora'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
