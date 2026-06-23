import type { Locale } from '../../i18n/I18nProvider';
import { useI18n } from '../../i18n/useI18n';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
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
          {option.label}
        </button>
      ))}
    </div>
  );
}
