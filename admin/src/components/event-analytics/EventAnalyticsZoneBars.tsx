import { useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { formatZoneRevenue } from './formatAnalyticsDelta';
import type { AnalyticsSlice } from './buildEventAnalyticsView';

type Props = {
  title: string;
  emptyLabel: string;
  rows: AnalyticsSlice[];
  currency?: string;
};

function niceChartMax(value: number) {
  if (value <= 0) {
    return 100_000;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function buildXTicks(maxValue: number) {
  const step = maxValue / 3;
  return Array.from({ length: 4 }, (_, index) => Math.round(step * index));
}

function formatAxisMoney(value: number, currency: string, locale: string) {
  if (value === 0) {
    return formatZoneRevenue(0, locale, currency);
  }

  if (value >= 1_000_000) {
    return `$${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `$${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value / 1_000)}K`;
  }

  return formatZoneRevenue(value, locale, currency);
}

export function EventAnalyticsZoneBars({
  title,
  emptyLabel,
  rows,
  currency = 'CLP',
}: Props) {
  const { numberLocale } = useI18n();
  const xMax = useMemo(
    () => niceChartMax(Math.max(...rows.map((row) => row.value), 0)),
    [rows],
  );
  const xTicks = useMemo(() => buildXTicks(xMax), [xMax]);

  return (
    <article className="event-analytics__panel event-analytics__panel--zones">
      <header className="event-analytics__panel-header">
        <h3>{title}</h3>
      </header>
      {rows.length === 0 ? (
        <p className="event-analytics__empty">{emptyLabel}</p>
      ) : (
        <div className="event-analytics-zone-chart">
          <ul className="event-analytics-zone-chart__rows">
            {rows.map((row) => (
              <li key={row.label} className="event-analytics-zone-chart__row">
                <span className="event-analytics-zone-chart__label">{row.label}</span>
                <div className="event-analytics-zone-chart__track">
                  <span
                    className="event-analytics-zone-chart__fill"
                    style={{ width: `${Math.min(100, (row.value / xMax) * 100)}%` }}
                  />
                </div>
                <strong className="event-analytics-zone-chart__value">
                  {formatZoneRevenue(row.value, numberLocale, currency)}
                </strong>
              </li>
            ))}
          </ul>
          <div className="event-analytics-zone-chart__axis" aria-hidden="true">
            <span className="event-analytics-zone-chart__axis-spacer" />
            <div className="event-analytics-zone-chart__axis-ticks">
              {xTicks.map((tick) => (
                <span key={tick}>{formatAxisMoney(tick, currency, numberLocale)}</span>
              ))}
            </div>
            <span className="event-analytics-zone-chart__axis-value-spacer" />
          </div>
        </div>
      )}
    </article>
  );
}
