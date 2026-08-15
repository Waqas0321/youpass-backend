import type { ReactNode } from 'react';
import {
  BEHAVIOR_CHART_AXIS_HOURS,
  buildSmoothPath,
  formatBehaviorAxisHour,
} from './eventAnalyticsChartUtils';

type Tone = 'purple' | 'blue' | 'green' | 'gold';

type Props = {
  tone: Tone;
  icon: ReactNode;
  label: string;
  value: string;
  deltaLabel: string;
  curve: number[];
  gradientId: string;
};

export function EventAnalyticsBehaviorCard({
  tone,
  icon,
  label,
  value,
  deltaLabel,
  curve,
  gradientId,
}: Props) {
  const width = 420;
  const height = 112;
  const padding = { top: 8, right: 8, bottom: 22, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...curve, 1);

  const chartPoints = curve.map((point, index) => {
    const x = padding.left + (index / Math.max(curve.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (point / max) * chartHeight;
    return { x, y };
  });

  const linePath = buildSmoothPath(chartPoints);
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1]?.x ?? padding.left} ${
    padding.top + chartHeight
  } L ${chartPoints[0]?.x ?? padding.left} ${padding.top + chartHeight} Z`;

  return (
    <article className={`event-analytics-behavior-card event-analytics-behavior-card--${tone}`}>
      <div className="event-analytics-behavior-card__header">
        <span className="event-analytics-behavior-card__icon">{icon}</span>
        <div className="event-analytics-behavior-card__meta">
          <p className="event-analytics-behavior-card__label">{label}</p>
          <strong className="event-analytics-behavior-card__value">{value}</strong>
          <span className="event-analytics-behavior-card__delta">{deltaLabel}</span>
        </div>
      </div>

      <div className="event-analytics-behavior-card__chart">
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--behavior-chart-fill-top)" />
              <stop offset="100%" stopColor="var(--behavior-chart-fill-bottom)" />
            </linearGradient>
          </defs>
          <path d={areaPath} className="event-analytics-behavior-card__area" fill={`url(#${gradientId})`} />
          <path d={linePath} className="event-analytics-behavior-card__line" />
          {BEHAVIOR_CHART_AXIS_HOURS.map((hour, index) => {
            const x =
              padding.left +
              (index / Math.max(BEHAVIOR_CHART_AXIS_HOURS.length - 1, 1)) * chartWidth;
            return (
              <text
                key={hour}
                x={x}
                y={height - 4}
                textAnchor="middle"
                className="event-analytics-behavior-card__axis"
              >
                {formatBehaviorAxisHour(hour)}
              </text>
            );
          })}
        </svg>
      </div>
    </article>
  );
}
