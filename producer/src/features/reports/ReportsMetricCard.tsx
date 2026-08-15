import type { ReactNode } from 'react';

type Props = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  tone: 'gold' | 'purple' | 'pink';
};

export function ReportsMetricCard({ title, value, subtitle, icon, tone }: Props) {
  return (
    <article className={`prod-reports-metric prod-reports-metric--${tone}`}>
      <div className="prod-reports-metric__icon">{icon}</div>
      <div className="prod-reports-metric__body">
        <h3>{title}</h3>
        <strong>{value}</strong>
        <p>{subtitle}</p>
      </div>
    </article>
  );
}
