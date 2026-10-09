import { AsyncLocalStorage } from 'node:async_hooks';

const SUPPORTED_LANGUAGES = new Set(['es', 'en', 'pt']);

const languageStorage = new AsyncLocalStorage<{ language?: string }>();

/** First supported primary tag of an Accept-Language header (e.g. "en-US,en;q=0.9" → "en"). */
export function parseAcceptLanguage(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
    if (tag && SUPPORTED_LANGUAGES.has(tag)) {
      return tag;
    }
  }
  return undefined;
}

export function runWithRequestLanguage(language: string | undefined, fn: () => void) {
  languageStorage.run({ language }, fn);
}

/** Language the client asked for (app UI language), if any. */
export function getRequestLanguage(): string | undefined {
  return languageStorage.getStore()?.language;
}

/**
 * Language for user-facing text in API responses: the client's UI language when it
 * sent one, otherwise the country default (e.g. Chile → es).
 */
export function resolveDisplayLanguage(countryLanguage?: string | null): string {
  return getRequestLanguage() ?? countryLanguage ?? 'es';
}
