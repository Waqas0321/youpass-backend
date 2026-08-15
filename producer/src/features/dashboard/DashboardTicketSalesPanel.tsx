import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { ticketCategoryLabel } from '../../i18n/localize';
import { buildDonutSegments, formatCount, formatPercent } from './dashboardChartUtils';
import type { TicketSalesEvent } from './dashboardDemo';

type Props = {
  events: TicketSalesEvent[];
};

function TicketSalesCard({ event }: { event: TicketSalesEvent }) {
  const { t, numberLocale } = useI18n();
  const sliceValues = event.slices.map((slice) => ({
    label: slice.id,
    value: slice.count,
    color: slice.color,
  }));
  const segments = buildDonutSegments(sliceValues, 40);
  const radius = 40;
  const totalSold = event.slices.reduce((sum, slice) => sum + slice.count, 0) || 1;

  return (
    <div className="prod-dash-ticket-card">
      <div className="prod-dash-ticket-card__info">
        <div className="prod-dash-ticket-card__heading">
          <strong>{event.title}</strong>
          <span>{event.producer}</span>
        </div>
        <p className="prod-dash-ticket-card__stats">
          {t('dashboard.capacityShort')}: {formatCount(event.capacity, numberLocale)} ·{' '}
          {t('dashboard.soldShort')}: {formatCount(event.sold, numberLocale)}
        </p>
      </div>

      <div className="prod-dash-ticket-card__chart">
        <svg viewBox="0 0 104 104" aria-hidden="true">
          <circle cx="52" cy="52" r={radius} className="prod-dash-mini-donut__track" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="52"
              cy="52"
              r={radius}
              className="prod-dash-mini-donut__slice"
              stroke={segment.color}
              strokeDasharray={`${segment.dash} ${2 * Math.PI * radius - segment.dash}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 52 52)"
            />
          ))}
        </svg>
        <div className="prod-dash-ticket-card__center">
          <strong>{formatPercent(event.soldPct, numberLocale)}%</strong>
          <span>{t('dashboard.soldLabel')}</span>
        </div>
      </div>

      <ul className="prod-dash-ticket-card__legend">
        {event.slices.map((slice) => {
          const pct = (slice.count / totalSold) * 100;
          return (
            <li key={slice.id}>
              <span className="prod-dash-mini-donut__swatch" style={{ background: slice.color }} />
              <span>{ticketCategoryLabel(t, slice.id)}</span>
              <strong>
                {formatCount(slice.count, numberLocale)} · {formatPercent(pct, numberLocale)}%
              </strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DashboardTicketSalesPanel({ events }: Props) {
  const { t } = useI18n();

  return (
    <article className="prod-dash-panel">
      <header className="prod-dash-panel__header">
        <h2>{t('dashboard.ticketSalesByEvent')}</h2>
        <Link to="/reports" className="prod-dash-panel__link">
          {t('dashboard.viewFullReport')} →
        </Link>
      </header>
      <div className="prod-dash-ticket-grid">
        {events.map((event) => (
          <TicketSalesCard key={event.id} event={event} />
        ))}
      </div>
      <footer className="prod-dash-panel__footer">
        <Link to="/events" className="prod-dash-panel__link">
          {t('dashboard.viewAllEvents')} →
        </Link>
      </footer>
    </article>
  );
}
