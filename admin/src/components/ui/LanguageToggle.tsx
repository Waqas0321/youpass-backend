import type { Locale } from '../../i18n/I18nProvider';
import { useI18n } from '../../i18n/useI18n';

const OPTIONS: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'common.languageEn' },
  { value: 'es', labelKey: 'common.languageEs' },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-toggle" role="group" aria-label={t('common.language')}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            locale === option.value
              ? 'language-toggle__btn language-toggle__btn--active'
              : 'language-toggle__btn'
          }
          onClick={() => setLocale(option.value)}
          aria-pressed={locale === option.value}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
