import { useI18n } from '../../i18n/useI18n';

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-toggle" role="group" aria-label={t('common.languageGroup')}>
      <button
        type="button"
        className={locale === 'en' ? 'language-toggle__btn is-active' : 'language-toggle__btn'}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('common.languageEn')}
      </button>
      <button
        type="button"
        className={locale === 'es' ? 'language-toggle__btn is-active' : 'language-toggle__btn'}
        aria-pressed={locale === 'es'}
        onClick={() => setLocale('es')}
      >
        {t('common.languageEs')}
      </button>
    </div>
  );
}
