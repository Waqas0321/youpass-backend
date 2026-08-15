import { useI18n } from '../../i18n/useI18n';

export function CalendarLegend() {
  const { t } = useI18n();

  return (
    <footer className="prod-cal-legend">
      <p>{t('calendar.dragHint')}</p>
      <p className="prod-cal-legend__scheduled">
        <span className="prod-cal-legend__dot" aria-hidden="true" />
        {t('calendar.scheduledDaysLegend')}
      </p>
    </footer>
  );
}
