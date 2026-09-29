import React, { createContext, useContext, useMemo } from 'react';
import { Language, TranslationDictionary } from './types';
import { en } from './locales/en';
import { es } from './locales/es';

const dictionaries: Record<Language, TranslationDictionary> = {
  en,
  es,
};

// Helper to resolve dot-notated paths safely like "sidebar.categories"
function resolvePath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export type TranslateFn = (
  path: string,
  params?: Record<string, string | number>
) => string;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export interface LanguageProviderProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  onLanguageChange,
  children,
}) => {
  const t = useMemo<TranslateFn>(() => {
    return (path: string, params?: Record<string, string | number>): string => {
      const activeDict = dictionaries[language] || dictionaries.en;
      let template = resolvePath(activeDict, path);

      // Fallback to English if not found in active dictionary
      if (template === undefined && language !== 'en') {
        template = resolvePath(dictionaries.en, path);
      }

      if (template === undefined) {
        return path;
      }

      if (params) {
        for (const [key, val] of Object.entries(params)) {
          template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        }
      }

      return template;
    };
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (newLang: Language) => {
        onLanguageChange?.(newLang);
      },
      t,
    }),
    [language, onLanguageChange, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
