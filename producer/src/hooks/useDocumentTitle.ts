import { useEffect } from 'react';
import { documentTitle, type PageKey } from '../i18n/localize';
import { useI18n } from '../i18n/useI18n';

export function useDocumentTitle(page: PageKey) {
  const { locale, t } = useI18n();

  useEffect(() => {
    document.title = documentTitle(t, page);
  }, [locale, page, t]);
}
