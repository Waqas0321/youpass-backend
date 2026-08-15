import type { ReactNode } from 'react';
import { IconTrending } from '../ui/Icons';

type Tone = 'purple' | 'blue' | 'green' | 'gold' | 'pink';

type Props = {
  label: string;
  value: string;
  deltaPct: number;
  deltaLabel: string;
  icon: ReactNode;
  tone: Tone;
};

function DeltaBadge({ deltaPct, deltaLabel }: { deltaPct: number; deltaLabel: string }) {
  const positive = deltaPct >= 0;

  return (
    <p className={`event-analytics-kpi__delta ${positive ? 'is-up' : 'is-down'}`}>
      <IconTrending className="event-analytics-kpi__delta-icon" />
      <span>{deltaLabel}</span>
    </p>
  );
}

export function EventAnalyticsKpiCard({ label, value, deltaPct, deltaLabel, icon, tone }: Props) {
  return (
    <article className={`event-analytics-kpi event-analytics-kpi--${tone}`}>
      <span className="event-analytics-kpi__icon">{icon}</span>
      <div className="event-analytics-kpi__body">
        <p className="event-analytics-kpi__label">{label}</p>
        <strong className="event-analytics-kpi__value">{value}</strong>
        <DeltaBadge deltaPct={deltaPct} deltaLabel={deltaLabel} />
      </div>
    </article>
  );
}
