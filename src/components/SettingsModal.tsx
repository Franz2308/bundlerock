import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Sun,
  Moon,
  Cpu,
  Layers,
  Network,
  Languages,
  Check,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, Language } from '../types/settings';
import { useTranslation } from '../i18n';

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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'appearance' | 'language' | 'interface' | 'network' | 'about'>('appearance');
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
    const defaults = { ...DEFAULT_SETTINGS };
    setTempSettings(defaults);
    onSaveSettings(defaults);
  };

  const handleLanguageSelect = (newLang: Language) => {
    const updated = { ...tempSettings, language: newLang };
    setTempSettings(updated);
    onSaveSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[1px]">
      <div className="relative w-full max-w-xl bg-slate-100 dark:bg-[#141b27] border border-slate-400 dark:border-[#2d3a4f] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh] my-auto select-none">
        
        {/* Win32 Window Header */}
        <div className="px-3 py-1.5 border-b border-slate-300 dark:border-[#202b3d] flex items-center justify-between bg-[#1a365d] dark:bg-[#12233c] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-300" />
            <h3 className="text-xs font-bold uppercase tracking-wide">
              {t('settings.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-red-600 rounded-none transition-colors text-white cursor-pointer"
            title={t('settings.close')}
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
              <span>{t('settings.tabAppearance')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('language')}
              className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer border ${
                activeTab === 'language'
                  ? 'bg-white dark:bg-[#1a2332] text-blue-900 dark:text-blue-300 font-bold border-slate-400 dark:border-blue-700 shadow-2xs'
                  : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#151c28]'
              }`}
            >
              <Languages className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>{t('settings.tabLanguage')}</span>
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
              <span>{t('settings.tabInterface')}</span>
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
              <span>{t('settings.tabNetwork')}</span>
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
              <span>{t('settings.tabAbout')}</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 dark:bg-[#141b27]">
            {/* Tab 1: Apariencia (Modo Claro vs Modo Oscuro) */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    {t('settings.themeTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    {t('settings.themeDesc')}
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
                            {t('settings.lightMode')}
                          </span>
                        </div>
                        {tempSettings.theme === 'light' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('settings.lightModeDesc')}
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
                            {t('settings.darkMode')}
                          </span>
                        </div>
                        {tempSettings.theme === 'dark' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('settings.darkModeDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Idioma / Language */}
            {activeTab === 'language' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    {t('settings.languageTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    {t('settings.languageDesc')}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* English Option */}
                    <div
                      onClick={() => handleLanguageSelect('en')}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        tempSettings.language === 'en'
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500'
                          : 'border-slate-300 dark:border-[#2a3649] bg-white dark:bg-[#17202f] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {t('settings.langEnglish')}
                          </span>
                        </div>
                        {tempSettings.language === 'en' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('settings.langEnglishDesc')}
                      </p>
                    </div>

                    {/* Spanish Option */}
                    <div
                      onClick={() => handleLanguageSelect('es')}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        tempSettings.language === 'es'
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500'
                          : 'border-slate-300 dark:border-[#2a3649] bg-white dark:bg-[#17202f] hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {t('settings.langSpanish')}
                          </span>
                        </div>
                        {tempSettings.language === 'es' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 font-bold" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t('settings.langSpanishDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Diagnóstico e Información de Interfaz */}
            {activeTab === 'interface' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    {t('settings.nerdStatsTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    {t('settings.nerdStatsDesc')}
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
                          {t('settings.nerdStatsCheck')}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                          {t('settings.nerdStatsCheckDesc')}
                        </span>
                      </div>
                    </label>

                    <div className="border-t border-slate-200 dark:border-[#232f42] pt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t('settings.nerdStatsCurrent')}
                      </div>
                      {tempSettings.nerdStats ? (
                        <div className="text-blue-700 dark:text-blue-400 font-medium">
                          {t('settings.nerdStatsActive')}
                        </div>
                      ) : (
                        <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {t('settings.nerdStatsInactive')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Red y Motores */}
            {activeTab === 'network' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
                    {t('settings.connectionsTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                    {t('settings.connectionsDesc')}
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
                        {t('settings.threads', { count: num })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-[#232f42]">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                    {t('settings.embeddedEngines')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] text-xs">
                      <div className="flex items-center gap-2">
                        {ytdlpInstalled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="font-semibold">{t('settings.ytdlpTitle')}</span>
                      </div>
                      <span className={`text-[11px] font-bold ${ytdlpInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                        {ytdlpInstalled ? t('settings.available') : t('settings.notInstalled')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649] text-xs">
                      <div className="flex items-center gap-2">
                        {ffmpegInstalled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="font-semibold">{t('settings.ffmpegTitle')}</span>
                      </div>
                      <span className={`text-[11px] font-bold ${ffmpegInstalled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                        {ffmpegInstalled ? t('settings.available') : t('settings.notInstalled')}
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
                        <span>{isInstallingDeps ? t('settings.installingDeps') : t('settings.installDepsBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Acerca de */}
            {activeTab === 'about' && (
              <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-3 bg-white dark:bg-[#17202f] border border-slate-300 dark:border-[#2a3649]">
                  <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                    {t('settings.aboutTitle')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    {t('settings.aboutVersion')}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                    {t('settings.aboutDesc')}
                  </p>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-[#232f42] pt-2">
                    {t('settings.aboutTech')}
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
            title={t('settings.defaultsTooltip')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{t('settings.defaults')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 dark:bg-[#1c2536] hover:bg-slate-300 dark:hover:bg-[#28354c] border border-slate-400 dark:border-[#384761] text-xs text-slate-700 dark:text-slate-300 cursor-pointer rounded-xs transition-colors"
            >
              {t('settings.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1 bg-[#1a365d] hover:bg-[#23487a] dark:bg-blue-700 dark:hover:bg-blue-600 border border-[#0f2442] dark:border-blue-900 text-xs font-bold text-white cursor-pointer rounded-xs shadow-xs transition-colors"
            >
              {t('settings.save')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
