import { useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardSalesPeriod } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { formatTodayDate } from '../../i18n/helpers';
import { IconChevronDown, IconInfo } from '../ui/Icons';
import {
  DASHBOARD_PERIOD_LABEL_KEYS,
  DASHBOARD_SALES_PERIODS,
  pickDefaultDashboardPeriod,
} from './dashboardData';

export type HourlySalesPoint = { hour: number; value: number };
export type HourlySalesByPeriod = Record<DashboardSalesPeriod, HourlySalesPoint[]>;

type DashboardSalesChartProps = {
  hourlySales?: HourlySalesPoint[];
  hourlyByPeriod?: HourlySalesByPeriod;
  title?: string;
  chartVariant?: 'gold' | 'purple';
  period?: DashboardSalesPeriod;
  onPeriodChange?: (period: DashboardSalesPeriod) => void;
  compact?: boolean;
  showInfo?: boolean;
  showPeriodFilter?: boolean;
  emptyLabel?: string;
};

const AXIS_BUCKET_INDICES = [0, 3, 6, 9, 12, 15, 18, 21];
const ZERO_HOURLY: HourlySalesPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));

function buildYAxis(maxValue: number) {
  if (maxValue <= 0) {
    return { yMax: 50, yTicks: [0, 10, 20, 30, 40, 50] };
  }

  const step = maxValue <= 50 ? 10 : maxValue <= 150 ? 25 : 50;
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const tickCount = Math.min(6, Math.floor(yMax / step) + 1);
  const yTicks = Array.from({ length: tickCount }, (_, index) => index * step);
  return { yMax, yTicks };
}

function normalizeHourlySales(hourlySales: HourlySalesPoint[]) {
  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourlySales.find((point) => point.hour === hour);
    return { hour, value: bucket?.value ?? 0 };
  });
}

function emptyHourlyByPeriod(): HourlySalesByPeriod {
  return {
    today: ZERO_HOURLY,
    yesterday: ZERO_HOURLY,
    last_7_days: ZERO_HOURLY,
    all_time: ZERO_HOURLY,
  };
}

function normalizeHourlyByPeriod(hourlyByPeriod?: HourlySalesByPeriod): HourlySalesByPeriod {
  if (!hourlyByPeriod) {
    return emptyHourlyByPeriod();
  }

  return {
    today: normalizeHourlySales(hourlyByPeriod.today ?? ZERO_HOURLY),
    yesterday: normalizeHourlySales(hourlyByPeriod.yesterday ?? ZERO_HOURLY),
    last_7_days: normalizeHourlySales(hourlyByPeriod.last_7_days ?? ZERO_HOURLY),
    all_time: normalizeHourlySales(hourlyByPeriod.all_time ?? ZERO_HOURLY),
  };
}

export function DashboardSalesChart({
  hourlySales,
  hourlyByPeriod,
  title,
  chartVariant = 'gold',
  period: controlledPeriod,
  onPeriodChange,
  compact = false,
  showInfo = false,
  showPeriodFilter,
  emptyLabel,
}: DashboardSalesChartProps) {
  const { t, dateLocale } = useI18n();
  const normalizedByPeriod = useMemo(() => normalizeHourlyByPeriod(hourlyByPeriod), [hourlyByPeriod]);
  const usesDirectHourly = hourlySales !== undefined;
  const showFilter = showPeriodFilter ?? !usesDirectHourly;
  const isControlled = controlledPeriod !== undefined;
  const [internalPeriod, setInternalPeriod] = useState<DashboardSalesPeriod>(() =>
    pickDefaultDashboardPeriod(normalizedByPeriod),
  );
  const period = isControlled ? controlledPeriod : internalPeriod;
  const setPeriod = (next: DashboardSalesPeriod) => {
    if (isControlled) {
      onPeriodChange?.(next);
      return;
    }
    setInternalPeriod(next);
  };
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isControlled || usesDirectHourly) {
      return;
    }
    setInternalPeriod(pickDefaultDashboardPeriod(normalizedByPeriod));
  }, [normalizedByPeriod, isControlled, usesDirectHourly]);

  const hourlySalesData = useMemo(
    () => (usesDirectHourly ? normalizeHourlySales(hourlySales) : normalizedByPeriod[period]),
    [usesDirectHourly, hourlySales, normalizedByPeriod, period],
  );

  useEffect(() => {
    if (!infoOpen && !menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setInfoOpen(false);
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [infoOpen, menuOpen]);

  const width = compact ? 560 : 760;
  const height = compact ? 220 : 300;
  const padding = { top: 18, right: 18, bottom: 34, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...hourlySalesData.map((point) => point.value), 0);
  const { yMax, yTicks } = useMemo(() => buildYAxis(maxValue), [maxValue]);

  const points = hourlySalesData.map((point, index) => {
    const x = padding.left + (index / Math.max(hourlySalesData.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (point.value / yMax) * chartHeight;
    return { x, y, ...point };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding.left} ${
    padding.top + chartHeight
  } L ${points[0]?.x ?? padding.left} ${padding.top + chartHeight} Z`;

  const peak = points.reduce(
    (best, point) => (point.value > best.value ? point : best),
    points[0] ?? { hour: 0, value: 0, x: 0, y: 0 },
  );

  const peakHour = `${String(peak.hour).padStart(2, '0')}:00`;
  const showPeakTooltip = peak.value > 0;
  const showEmptyState = maxValue === 0;

  const chartTitle =
    title ?? (usesDirectHourly ? t('dashboard.ticketSalesLast24Hours') : t('dashboard.ticketSalesByHour'));
  const fillGradientId = chartVariant === 'purple' ? 'dash-sales-fill-purple' : 'dash-sales-fill';
  const lineClass =
    chartVariant === 'purple' ? 'dash-chart__line dash-chart__line--purple' : 'dash-chart__line';
  const peakClass =
    chartVariant === 'purple' ? 'dash-chart__peak dash-chart__peak--purple' : 'dash-chart__peak';
  const panelClass =
    chartVariant === 'purple'
      ? 'dash-panel dash-panel--chart dash-panel--chart-purple'
      : `dash-panel dash-panel--chart${compact ? ' dash-panel--chart-compact' : ''}`;

  const periodFilterLabel = (option: DashboardSalesPeriod) =>
    option === 'today' ? formatTodayDate(dateLocale, t) : t(DASHBOARD_PERIOD_LABEL_KEYS[option]);

  return (
    <article ref={panelRef} className={panelClass}>
      <header className="dash-panel__header">
        <div className="dash-panel__title-wrap">
          <h3>{chartTitle}</h3>
          {showInfo ? (
            <div className="dash-panel__info-wrap">
              <button
                type="button"
                className={`dash-panel__info ${infoOpen ? 'dash-panel__info--active' : ''}`}
                aria-label={t('dashboard.chartInfo')}
                aria-expanded={infoOpen}
                onClick={() => {
                  setInfoOpen((open) => !open);
                  setMenuOpen(false);
                }}
              >
                <IconInfo />
              </button>
              {infoOpen ? (
                <div className="dash-panel__popover" role="tooltip">
                  <p>{t('dashboard.chartInfoDescription')}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {showFilter ? (
          <div className="dash-panel__filter-wrap">
            <button
              type="button"
              className={`dash-panel__filter ${menuOpen ? 'dash-panel__filter--open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open);
                setInfoOpen(false);
              }}
            >
              {periodFilterLabel(period)}
              <IconChevronDown className="dash-panel__filter-chevron" />
            </button>
            {menuOpen ? (
              <ul className="dash-panel__filter-menu" role="listbox">
                {DASHBOARD_SALES_PERIODS.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={period === option}
                      className={period === option ? 'is-active' : undefined}
                      onClick={() => {
                        setPeriod(option);
                        setMenuOpen(false);
                      }}
                    >
                      {periodFilterLabel(option)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="dash-chart">
        {showEmptyState ? (
          <p className="dash-chart__empty">
            {emptyLabel ??
              (usesDirectHourly ? t('dashboard.chartEmptyLast24Hours') : t('dashboard.chartEmptyPeriod'))}
          </p>
        ) : null}
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chartTitle}>
          <defs>
            <linearGradient id="dash-sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 184, 0, 0.42)" />
              <stop offset="100%" stopColor="rgba(255, 184, 0, 0)" />
            </linearGradient>
            <linearGradient id="dash-sales-fill-purple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(156, 95, 212, 0.45)" />
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
                  className="dash-chart__grid"
                />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="dash-chart__axis-y">
                  {tick}
                </text>
              </g>
            );
          })}
          {!showEmptyState ? (
            <>
              <path d={areaPath} fill={`url(#${fillGradientId})`} />
              <path d={linePath} className={lineClass} />
            </>
          ) : null}
          {showPeakTooltip ? (
            <>
              <circle cx={peak.x} cy={peak.y} r="6" className={peakClass} />
              <g
                className="dash-chart__tooltip"
                transform={`translate(${Math.min(peak.x - 52, width - 120)}, ${peak.y - 58})`}
              >
                <rect width="104" height="48" rx="10" />
                <text x="14" y="18" className="dash-chart__tooltip-hour">
                  {peakHour}
                </text>
                <circle cx="20" cy="34" r="3" className="dash-chart__tooltip-dot" />
                <text x="30" y="37" className="dash-chart__tooltip-value">
                  {t('dashboard.salesTooltip', { value: String(peak.value) })}
                </text>
              </g>
            </>
          ) : null}
          {AXIS_BUCKET_INDICES.map((bucketIndex) => {
            const bucket = hourlySalesData[bucketIndex];
            const x =
              padding.left +
              (bucketIndex / Math.max(hourlySalesData.length - 1, 1)) * chartWidth;
            const label = `${String(bucket?.hour ?? bucketIndex).padStart(2, '0')}:00`;
            return (
              <text key={bucketIndex} x={x} y={height - 10} textAnchor="middle" className="dash-chart__axis">
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </article>
  );
}
