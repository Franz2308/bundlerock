import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Sun,
  Moon,
  Cpu,
  Layers,
  Network,
  Check,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  ytdlpInstalled?: boolean;
  ffmpegInstalled?: boolean;
  isInstallingDeps?: boolean;
  onInstallDependencies?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  ytdlpInstalled = false,
  ffmpegInstalled = false,
  isInstallingDeps = false,
  onInstallDependencies,
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'interface' | 'network' | 'about'>('appearance');
  const [tempSettings, setTempSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setTempSettings(settings);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(tempSettings);
    onClose();
  };

  const handleReset = () => {
    setTempSettings(DEFAULT_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-xl bg-slate-100 dark:bg-[#141b27] border border-slate-400 dark:border-[#2d3a4f] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh] my-auto select-none">
        
        {/* Win32 Window Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 dark:border-[#202b3d] flex items-center justify-between bg-[#1a365d] dark:bg-[#12233c] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-300" />
            <h3 className="text-xs font-bold uppercase tracking-wide">
              Configuración de BundleRock
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-red-600 rounded-none transition-colors text-white cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex flex-1 min-h-[360px] overflow-hidden">
          {/* Vertical Navigation Tabs */}
          <div className="w-40 sm:w-44 bg-slate-200 dark:bg-[#0f1520] border-r border-slate-300 dark:border-[#232f42] p-2 flex flex-col gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer border ${
                activeTab === 'appearance'
                  ? 'bg-white dark:bg-[#1a2332] text-blue-900 dark:text-blue-300 font-bold border-slate-400 dark:border-blue-700 shadow-2xs'
                  : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#151c28]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Apariencia</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('interface')}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer border ${
                activeTab === 'interface'
                  ? 'bg-white dark:bg-[#1a2332] text-blue-900 dark:text-blue-300 font-bold border-slate-400 dark:border-blue-700 shadow-2xs'
                  : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#151c28]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Diagnóstico UI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer border ${
                activeTab === 'network'
                  ? 'bg-white dark:bg-[#1a2332] text-blue-900 dark:text-blue-300 font-bold border-slate-400 dark:border-blue-700 shadow-2xs'
                  : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#151c28]'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Red y Motores</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer border mt-auto ${
                activeTab === 'about'
                  ? 'bg-white dark:bg-[#1a2332] text-blue-900 dark:text-blue-300 font-bold border-slate-400 dark:border-blue-700 shadow-2xs'
                  : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#151c28]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Acerca de</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 dark:bg-[#141b27]">
            {/* Tab 1: Apariencia (Modo Claro vs Modo Oscuro) */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    Tema del Gestor
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    Seleccione el esquema de color visual para la interfaz. Ambos temas mantienen la identidad Win32 retro.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Modo Claro */}
                    <div
                      onClick={() => setTempSettings({ ...tempSettings, theme: 'light' })}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        tempSettings.theme === 'light'
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500'
                          : 'border-slate-300 dark:border-[#2a3649] bg-white dark:bg-[#17202f] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Modo Claro
                          </span>
                        </div>
                        {tempSettings.theme === 'light' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Estilo clásico IDM empresarial con fondo gris pizarra y superficies claras.
                      </p>
                    </div>

                    {/* Modo Oscuro */}
                    <div
                      onClick={() => setTempSettings({ ...tempSettings, theme: 'dark' })}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        tempSettings.theme === 'dark'
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500'
                          : 'border-slate-300 dark:border-[#2a3649] bg-white dark:bg-[#17202f] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Moon className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Modo Oscuro
                          </span>
                        </div>
                        {tempSettings.theme === 'dark' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Paleta nocturna con tonos azul grisáceo (#101520), alto contraste y menor fatiga ocular.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Diagnóstico e Información de Interfaz */}
            {activeTab === 'interface' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    Nivel de Información Técnica
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    Controle qué volumen de datos técnicos y métricas de depuración se presentan en las listas de descargas.
                  </p>

                  <div className="p-3 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempSettings.nerdStats}
                        onChange={(e) => setTempSettings({ ...tempSettings, nerdStats: e.target.checked })}
                        className="mt-0.5 w-4 h-4 accent-blue-600 rounded-none cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Activar Estadísticas Avanzadas (Estadísticas para Nerds)
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                          Muestra métricas detalladas en tiempo real: número de hilos activos, rangos de bytes por conexión, soporte multihilo de servidor y tabla de inspección de segmentos.
                        </span>
                      </div>
                    </label>

                    <div className="border-t border-slate-200 dark:border-[#232f42] pt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Estado actual:
                      </div>
                      {tempSettings.nerdStats ? (
                        <div className="text-blue-700 dark:text-blue-400 font-medium">
                          Modo Avanzado activo: Se muestran hilos, cabeceras HTTP y estructura de chunks.
                        </div>
                      ) : (
                        <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Modo Minimalista activo (Recomendado): Interfaz limpia enfocada únicamente en el avance y velocidad de descarga.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Red y Motores */}
            {activeTab === 'network' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    Concurrencia de Conexiones
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    Número de hilos paralelos predeterminado sugerido al iniciar una nueva descarga directa o stream multimedia.
                  </p>

                  <div className="grid grid-cols-4 gap-2">
                    {[4, 8, 16, 32].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTempSettings({ ...tempSettings, defaultConnections: num })}
                        className={`py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                          tempSettings.defaultConnections === num
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white dark:bg-[#17202f] border-slate-300 dark:border-[#2a3649] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1f2b3e]'
                        }`}
                      >
                        {num} hilos
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-[#232f42]">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                    Motores Multimedia Embebidos
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] text-xs">
                      <div className="flex items-center gap-2">
                        {ytdlpInstalled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="font-semibold">yt-dlp (Extractor de streams)</span>
                      </div>
                      <span className={`text-[11px] font-bold ${ytdlpInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                        {ytdlpInstalled ? 'Disponible' : 'No instalado'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] text-xs">
                      <div className="flex items-center gap-2">
                        {ffmpegInstalled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="font-semibold">FFmpeg (Remuxer y conversor GIF)</span>
                      </div>
                      <span className={`text-[11px] font-bold ${ffmpegInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                        {ffmpegInstalled ? 'Disponible' : 'No instalado'}
                      </span>
                    </div>

                    {(!ytdlpInstalled || !ffmpegInstalled) && onInstallDependencies && (
                      <button
                        type="button"
                        disabled={isInstallingDeps}
                        onClick={onInstallDependencies}
                        className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isInstallingDeps ? 'Instalando componentes...' : 'Instalar dependencias faltantes automáticamente'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Acerca de */}
            {activeTab === 'about' && (
              <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649]">
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    BundleRock
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Versión 0.2.0 (Alpha Release)
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                    Gestor de descargas acelerado multihilo de alta velocidad con soporte para streams multimedia dinámicos, segmentación simultánea y estética retro Win32 enterprise.
                  </p>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#232f42] pt-2">
                    Construido con Tauri 2, Rust, Tokio, React 19, TypeScript y Tailwind CSS.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="px-3 py-2 border-t border-slate-300 dark:border-[#202b3d] bg-slate-200 dark:bg-[#0f1520] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-300 dark:hover:bg-[#28354c] border border-slate-400 dark:border-[#384761] text-xs text-slate-700 dark:text-slate-300 cursor-pointer rounded-xs transition-colors"
            title="Restablecer valores por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Predeterminados</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-300 dark:hover:bg-[#28354c] border border-slate-400 dark:border-[#384761] text-xs text-slate-700 dark:text-slate-300 cursor-pointer rounded-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1 bg-[#1a365d] hover:bg-[#23487a] dark:bg-blue-700 dark:hover:bg-blue-600 border border-[#0f2442] dark:border-blue-900 text-xs font-bold text-white cursor-pointer rounded-xs shadow-xs transition-colors"
            >
              Guardar y Aplicar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
