import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { producerBarLabel, type ProducerBarItem } from './dashboardDemo';

type Props = {
  items: ProducerBarItem[];
};

export function DashboardActiveEventsPanel({ items }: Props) {
  const { t } = useI18n();

  return (
    <article className="prod-dash-panel">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.activeEventsByProducer')}</h2>
      </header>
      <ul className="prod-dash-producers">
        {items.map((item) => (
          <li key={item.id} className="prod-dash-producers__row">
            <span className="prod-dash-producers__avatar" style={{ background: item.color }}>
              {item.initials}
            </span>
            <span className="prod-dash-producers__label">{producerBarLabel(item.id)}</span>
            <div className="prod-dash-producers__track">
              <span
                className="prod-dash-producers__fill"
                style={{
                  width: `${(item.value / item.max) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
            <strong className="prod-dash-producers__value">{item.value}</strong>
          </li>
        ))}
      </ul>
      <footer className="prod-dash-panel__footer">
        <Link to="/events" className="prod-dash-panel__link">
          {t('dashboard.viewAllEvents')} →
        </Link>
      </footer>
    </article>
  );
}
