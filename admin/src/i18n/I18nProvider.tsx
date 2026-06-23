import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { Messages } from './en';
import { en } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

const STORAGE_KEY = 'youpass-admin-locale';

const catalogs: Record<Locale, Messages> = { en, es };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dateLocale: string;
  numberLocale: string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'es' ? 'es' : 'en';
}

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const messages = catalogs[locale];
    return {
      locale,
      setLocale,
      t: (key, params) => interpolate(lookup(messages, key) ?? key, params),
      dateLocale: locale === 'es' ? 'es-CL' : 'en-US',
      numberLocale: locale === 'es' ? 'es-CL' : 'en-US',
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
