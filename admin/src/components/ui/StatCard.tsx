type StatCardProps = {
  label: string;
  value: number | string;
  tone?: 'default' | 'gold' | 'green' | 'purple';
  hint?: string;
};

const toneClass = {
  default: '',
  gold: 'stat-card--gold',
  green: 'stat-card--green',
  purple: 'stat-card--purple',
};

export function StatCard({ label, value, tone = 'default', hint }: StatCardProps) {
  return (
    <article className={`stat-card ${toneClass[tone]}`}>
      <div className="stat-card__top">
        <span>{label}</span>
        <div className="stat-card__dot" />
      </div>
      <strong>{value}</strong>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </article>
  );
}
