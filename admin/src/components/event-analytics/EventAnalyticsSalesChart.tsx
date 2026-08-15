import { useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { formatAnalyticsCurrency } from './formatAnalyticsDelta';

export type AnalyticsHourlyPoint = { hour: number; value: number };

type Props = {
  hourlySales: AnalyticsHourlyPoint[];
  title: string;
  currency?: string;
};

/** Event sales window: noon → 06:00 next day (mockup axis). */
const EVENT_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
const AXIS_LABEL_HOURS = [12, 15, 18, 21, 0, 3, 6];

function valueForHour(hourlySales: AnalyticsHourlyPoint[], hour: number) {
  return hourlySales.find((point) => point.hour === hour)?.value ?? 0;
}

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

function buildYTicks(maxValue: number) {
  const step = maxValue / 5;
  return Array.from({ length: 6 }, (_, index) => Math.round(step * index));
}

function formatAxisMoney(value: number, currency: string, locale: string) {
  if (value === 0) {
    return formatAnalyticsCurrency(0, locale, currency);
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Number.isInteger(millions) ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(millions);
    return `${formatted}M`;
  }

  if (value >= 1_000) {
    const thousands = value / 1_000;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Number.isInteger(thousands) ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(thousands);
    return `${formatted}K`;
  }

  return formatAnalyticsCurrency(value, locale, currency);
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function EventAnalyticsSalesChart({
  hourlySales,
  title,
  currency = 'CLP',
}: Props) {
  const { numberLocale } = useI18n();

  const windowPoints = useMemo(
    () =>
      EVENT_HOURS.map((hour, index) => ({
        hour,
        value: valueForHour(hourlySales, hour),
        index,
      })),
    [hourlySales],
  );

  const yMax = useMemo(
    () => niceChartMax(Math.max(...windowPoints.map((point) => point.value), 0)),
    [windowPoints],
  );
  const yTicks = useMemo(() => buildYTicks(yMax), [yMax]);

  const width = 760;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 32, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const chartPoints = windowPoints.map((point) => {
    const x =
      padding.left +
      (point.index / Math.max(windowPoints.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (point.value / yMax) * chartHeight;
    return { x, y, hour: point.hour, value: point.value };
  });

  const linePath = buildSmoothPath(chartPoints);
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1]?.x ?? padding.left} ${
    padding.top + chartHeight
  } L ${chartPoints[0]?.x ?? padding.left} ${padding.top + chartHeight} Z`;

  const peak = chartPoints.reduce(
    (best, point) => (point.value > best.value ? point : best),
    chartPoints[0] ?? { hour: 0, value: 0, x: 0, y: 0 },
  );

  return (
    <article className="event-analytics__panel event-analytics__panel--chart event-analytics-sales-chart">
      <header className="event-analytics__panel-header event-analytics__panel-header--chart">
        <h3>{title}</h3>
      </header>
      <div className="event-analytics-sales-chart__body">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <defs>
            <linearGradient id="analytics-sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(156, 95, 212, 0.5)" />
              <stop offset="100%" stopColor="rgba(156, 95, 212, 0)" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = padding.top + chartHeight - (tick / yMax) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  className="event-analytics-sales-chart__grid"
                />
                <text
                  x={padding.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="event-analytics-sales-chart__axis-y"
                >
                  {formatAxisMoney(tick, currency, numberLocale)}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill="url(#analytics-sales-fill)" />
          <path d={linePath} className="event-analytics-sales-chart__line" />
          {peak.value > 0 ? (
            <circle cx={peak.x} cy={peak.y} r="5" className="event-analytics-sales-chart__peak" />
          ) : null}
          {AXIS_LABEL_HOURS.map((hour) => {
            const index = EVENT_HOURS.indexOf(hour);
            const x =
              index >= 0
                ? padding.left + (index / Math.max(EVENT_HOURS.length - 1, 1)) * chartWidth
                : padding.left;
            return (
              <text
                key={hour}
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="event-analytics-sales-chart__axis-x"
              >
                {formatHourLabel(hour)}
              </text>
            );
          })}
        </svg>
      </div>
    </article>
  );
}
