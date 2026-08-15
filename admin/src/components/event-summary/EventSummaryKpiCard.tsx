import type { ReactNode } from 'react';

type EventSummaryKpiCardProps = {
  label: string;
  value: string;
  hint: string;
  hintTone?: 'neutral' | 'positive' | 'negative';
  icon: ReactNode;
  variant: 'progress' | 'sparkline';
  progressPct?: number;
  sparkline?: number[];
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) {
    return null;
  }

  const width = 88;
  const height = 36;
  const range = max - min;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="event-summary-kpi__sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

export function EventSummaryKpiCard({
  label,
  value,
  hint,
  hintTone = 'neutral',
  icon,
  variant,
  progressPct = 0,
  sparkline = [],
}: EventSummaryKpiCardProps) {
  const clampedProgress = Math.max(0, Math.min(progressPct, 100));

  return (
    <article className="event-summary-kpi">
      <div className="event-summary-kpi__top">
        <span className="event-summary-kpi__icon">{icon}</span>
        {variant === 'sparkline' ? <Sparkline values={sparkline} /> : null}
      </div>
      <p className="event-summary-kpi__label">{label}</p>
      <strong className="event-summary-kpi__value">{value}</strong>
      <p className={`event-summary-kpi__hint event-summary-kpi__hint--${hintTone}`}>{hint}</p>
      {variant === 'progress' ? (
        <div className="event-summary-kpi__progress" aria-hidden="true">
          <span style={{ width: `${clampedProgress}%` }} />
        </div>
      ) : null}
    </article>
  );
}
