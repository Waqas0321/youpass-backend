import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../types';
import { en } from './en';
import { es } from './es';
import { createTranslator, type TranslateFn } from './translate';

const STORAGE_KEY = 'youpass-producer-locale';

const catalogs = { en, es } as const;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  dateLocale: string;
  numberLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'es';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'es' ? stored : 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'es' ? 'es' : 'en';
  }, []);

  const value = useMemo((): I18nContextValue => {
    const messages = catalogs[locale];
    return {
      locale,
      setLocale,
      t: createTranslator(messages),
      dateLocale: locale === 'es' ? 'es-CL' : 'en-US',
      numberLocale: locale === 'es' ? 'es-CL' : 'en-US',
    };
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === 'es' ? 'es' : 'en';
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
