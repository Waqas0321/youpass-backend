import { useI18n } from '../../i18n/useI18n';
import type { AnalyticsSlice } from './buildEventAnalyticsView';
import { donutColorsFor, type DonutPalette } from './eventAnalyticsChartColors';

type Props = {
  title: string;
  emptyLabel: string;
  slices: AnalyticsSlice[];
  palette?: DonutPalette;
  centerDisplay?: string;
  panelVariant?: 'default' | 'payment';
};

function formatSlicePercent(value: number, total: number, locale: string) {
  const pct = (value / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rounded)}%`;
}

export function EventAnalyticsDonutPanel({
  title,
  emptyLabel,
  slices,
  palette = 'default',
  centerDisplay,
  panelVariant = 'default',
}: Props) {
  const { t, numberLocale } = useI18n();
  const colors = donutColorsFor(palette);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const safeTotal = total || 1;
  const radius = 50;
  const strokeWidth = 17;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const panelClass =
    panelVariant === 'payment'
      ? 'event-analytics__panel event-analytics__panel--donut event-analytics__panel--payment'
      : 'event-analytics__panel event-analytics__panel--donut';

  return (
    <article className={panelClass}>
      <header className="event-analytics__panel-header">
        <h3>{title}</h3>
      </header>
      <div className="event-analytics__donut">
        {slices.length === 0 ? (
          <p className="event-analytics__empty">{emptyLabel}</p>
        ) : (
          <>
            <div className="event-analytics__donut-chart">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="event-analytics__donut-track"
                  style={{ strokeWidth }}
                />
                {slices.map((slice, index) => {
                  const fraction = slice.value / safeTotal;
                  const dash = fraction * circumference;
                  const circle = (
                    <circle
                      key={slice.label}
                      cx="60"
                      cy="60"
                      r={radius}
                      className="event-analytics__donut-slice"
                      stroke={colors[index % colors.length]}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 60 60)"
                    />
                  );
                  offset += dash;
                  return circle;
                })}
              </svg>
              <div className="event-analytics__donut-center">
                <span>{t('eventAnalytics.donutTotal')}</span>
                <strong>
                  {centerDisplay ?? new Intl.NumberFormat(numberLocale).format(total)}
                </strong>
              </div>
            </div>
            <ul className="event-analytics__donut-legend">
              {slices.map((slice, index) => (
                <li key={slice.label}>
                  <span
                    className="event-analytics__donut-swatch"
                    style={{ background: colors[index % colors.length] }}
                  />
                  <span>{slice.label}</span>
                  <strong>{formatSlicePercent(slice.value, safeTotal, numberLocale)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}
