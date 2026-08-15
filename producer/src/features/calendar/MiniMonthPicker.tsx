import { useMemo } from 'react';
import { IconChevronLeft, IconChevronRight } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { addMonths, buildMonthWeeks, formatMonthLabel, weekdayLabels } from './calendarUtils';

type Props = {
  year: number;
  month: number;
  selectedIso: string;
  onMonthChange: (year: number, month: number) => void;
  onSelect: (iso: string) => void;
};

export function MiniMonthPicker({ year, month, selectedIso, onMonthChange, onSelect }: Props) {
  const { t, dateLocale } = useI18n();
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const weekdays = useMemo(() => weekdayLabels(dateLocale), [dateLocale]);
  const monthLabel = formatMonthLabel(year, month, dateLocale);

  return (
    <div className="prod-cal-picker">
      <div className="prod-cal-picker__nav">
        <button
          type="button"
          className="prod-cal-picker__arrow"
          aria-label={t('calendar.previousMonth')}
          onClick={() => {
            const next = addMonths(year, month, -1);
            onMonthChange(next.year, next.month);
          }}
        >
          <IconChevronLeft />
        </button>
        <strong className="prod-cal-picker__month">{monthLabel}</strong>
        <button
          type="button"
          className="prod-cal-picker__arrow"
          aria-label={t('calendar.nextMonth')}
          onClick={() => {
            const next = addMonths(year, month, 1);
            onMonthChange(next.year, next.month);
          }}
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="prod-cal-picker__weekdays">
        {weekdays.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="prod-cal-picker__weeks">
        {weeks.map((week) => (
          <div key={week[0]?.iso} className="prod-cal-picker__week">
            {week.map((day) => {
              const isSelected = day.iso === selectedIso;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={[
                    'prod-cal-picker__day',
                    !day.inCurrentMonth ? 'prod-cal-picker__day--muted' : '',
                    isSelected ? 'prod-cal-picker__day--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelect(day.iso)}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
