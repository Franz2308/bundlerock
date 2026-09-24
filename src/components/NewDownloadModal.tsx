import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { ProbeResult } from '../types/download';
import { formatBytes } from '../utils/formatters';
import { probeUrl, getDefaultDirectory } from '../services/downloadApi';
import { cn } from '../utils/cn';

interface NewDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDownload: (params: {
    url: string;
    destinationPath?: string;
    fileName?: string;
    connections: number;
  }) => Promise<void>;
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

  // Initialize and check clipboard on open
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setFileName('');
      setProbeResult(null);
      setProbeError(null);
      setStarting(false);
      return;
    }

    // Load default directory
    getDefaultDirectory().then((dir) => {
      if (dir) setSavePath(dir);
    });

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
      if (res.suggested_connections) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
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
                Aceleración dinámica multiconexión
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
              Enlace de descarga (URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ejemplo.com/archivo.zip"
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

          {/* Probing Progress / Result Card */}
          {probing && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-500/20 flex items-center gap-3 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span className="text-xs text-slate-300">
                Sondeando servidor y detectando capacidad de rangos...
              </span>
            </div>
          )}

          {probeError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{probeError}</span>
            </div>
          )}

          {probeResult && !probing && (
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

          {/* Connection Threads Selector */}
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
                const disabled = Boolean(probeResult && !probeResult.accept_ranges && num > 1);
                return (
                  <button
                    type="button"
                    key={num}
                    disabled={disabled}
                    onClick={() => setConnections(num)}
                    title={disabled ? 'El servidor no admite descargas en múltiples conexiones' : undefined}
                    className={cn(
                      'py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer',
                      connections === num
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                        : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200',
                      disabled && 'opacity-40 cursor-not-allowed hover:border-slate-800 hover:text-slate-400'
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
              ) : (
                <Download className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>Descargar Ahora</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
