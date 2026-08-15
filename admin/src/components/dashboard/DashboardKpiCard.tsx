import type { ReactNode } from 'react';

type DashboardKpiCardProps = {
  label: string;
  value: string;
  deltaLabel: string;
  deltaPositive?: boolean;
  deltaNeutral?: boolean;
  sparkline: number[];
  icon: ReactNode;
};

function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;

  // Equal values = no trend to show (avoids a misleading line at the top or bottom).
  if (flat) {
    return null;
  }

  const width = 72;
  const height = 28;
  const range = max - min;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className="dash-kpi__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      aria-label={label}
    >
      <polyline points={points} />
    </svg>
  );
}

export function DashboardKpiCard({
  label,
  value,
  deltaLabel,
  deltaPositive = true,
  deltaNeutral = false,
  sparkline,
  icon,
}: DashboardKpiCardProps) {
  const deltaClass = deltaNeutral
    ? 'dash-kpi__delta dash-kpi__delta--neutral'
    : `dash-kpi__delta ${deltaPositive ? 'dash-kpi__delta--up' : 'dash-kpi__delta--down'}`;

  return (
    <article className="dash-kpi">
      <div className="dash-kpi__top">
        <span className="dash-kpi__icon">{icon}</span>
        <Sparkline values={sparkline} label={label} />
      </div>
      <p className="dash-kpi__label">{label}</p>
      <strong className="dash-kpi__value">{value}</strong>
      <p className={deltaClass}>{deltaLabel}</p>
    </article>
  );
}
