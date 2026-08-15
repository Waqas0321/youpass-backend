import { IconChevronLeft, IconChevronRight, IconPlus } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { formatMonthLabel } from './calendarUtils';

type Props = {
  year: number;
  month: number;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onReschedule: () => void;
};

export function CalendarToolbar({
  year,
  month,
  onPrevious,
  onNext,
  onToday,
  onReschedule,
}: Props) {
  const { t, dateLocale } = useI18n();
  const monthLabel = formatMonthLabel(year, month, dateLocale);

  return (
    <div className="prod-cal-toolbar">
      <div className="prod-cal-toolbar__nav">
        <button type="button" className="prod-cal-toolbar__arrow" onClick={onPrevious} aria-label={t('calendar.previousMonth')}>
          <IconChevronLeft />
        </button>
        <button type="button" className="prod-cal-toolbar__arrow" onClick={onNext} aria-label={t('calendar.nextMonth')}>
          <IconChevronRight />
        </button>
        <button type="button" className="prod-cal-toolbar__today" onClick={onToday}>
          {t('calendar.today')}
        </button>
        <h2 className="prod-cal-toolbar__month">{monthLabel}</h2>
      </div>

      <button type="button" className="prod-cal-toolbar__cta" onClick={onReschedule}>
        <IconPlus className="prod-cal-toolbar__cta-icon" />
        <span>{t('calendar.rescheduleEvents')}</span>
      </button>
    </div>
  );
}
