import { IconTable } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { VipTableStatus } from './eventVipTablesData';

const LEGEND_ITEMS: Array<{
  status: VipTableStatus;
  tone: string;
}> = [
  { status: 'available', tone: 'available' },
  { status: 'reserved', tone: 'reserved' },
  { status: 'paid', tone: 'paid' },
  { status: 'blocked', tone: 'blocked' },
];

export function EventVipTablesStatusLegend() {
  const { t } = useI18n();

  return (
    <section className="event-vip-tables__legend" aria-label={t('eventVipTables.legendTitle')}>
      <h2>{t('eventVipTables.legendTitle')}</h2>
      <div className="event-vip-tables__legend-grid">
        {LEGEND_ITEMS.map(({ status, tone }) => (
          <article key={status} className={`event-vip-tables__legend-card event-vip-tables__legend-card--${tone}`}>
            <span className="event-vip-tables__legend-icon" aria-hidden>
              <IconTable />
            </span>
            <div>
              <strong>{t(`eventVipTables.status.${status}`)}</strong>
              <p>{t(`eventVipTables.legend.${status}`)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
