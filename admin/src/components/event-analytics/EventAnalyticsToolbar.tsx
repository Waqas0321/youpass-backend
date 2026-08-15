import { useEffect, useRef, useState } from 'react';
import type { DashboardSalesPeriod } from '../../api/client';
import {
  DASHBOARD_PERIOD_LABEL_KEYS,
  DASHBOARD_SALES_PERIODS,
} from '../dashboard/dashboardData';
import { useI18n } from '../../i18n/useI18n';
import { IconCalendar, IconChevronDown } from '../ui/Icons';

type Props = {
  period: DashboardSalesPeriod;
  dateRangeLabel: string;
  onPeriodChange: (period: DashboardSalesPeriod) => void;
};

export function EventAnalyticsToolbar({ period, dateRangeLabel, onPeriodChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="event-analytics__toolbar" ref={rootRef}>
      <div className="event-analytics__period-picker">
        <button
          type="button"
          className="event-analytics__date-range"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <IconCalendar className="event-analytics__date-icon" />
          <span>{dateRangeLabel}</span>
          <IconChevronDown className="event-analytics__date-icon" />
        </button>

        {open ? (
          <ul className="event-analytics__period-menu" role="listbox">
            {DASHBOARD_SALES_PERIODS.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option === period}
                  className={
                    option === period
                      ? 'event-analytics__period-option event-analytics__period-option--active'
                      : 'event-analytics__period-option'
                  }
                  onClick={() => {
                    onPeriodChange(option);
                    setOpen(false);
                  }}
                >
                  {t(DASHBOARD_PERIOD_LABEL_KEYS[option])}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
