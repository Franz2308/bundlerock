export interface AppSettings {
  theme: 'light' | 'dark';
  nerdStats: boolean;
  defaultConnections: number;
  soundOnComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  nerdStats: false,
  defaultConnections: 8,
  soundOnComplete: false,
};

export const SETTINGS_STORAGE_KEY = 'bundlerock_settings';

export const loadStoredSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveStoredSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error guardando configuracion:', e);
  }
};
