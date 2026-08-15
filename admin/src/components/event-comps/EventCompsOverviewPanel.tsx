import { COMP_STATUSES, COMP_TYPES, type CompStatusId, type CompTypeId } from './eventCompsUtils';
import { useI18n } from '../../i18n/useI18n';
import {
  IconCrown,
  IconDrink,
  IconInfo,
  IconSpark,
  IconStar,
  IconUsers,
} from '../ui/Icons';

type Props = {
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  activeType?: CompTypeId | 'all';
  statusFilters?: Set<CompStatusId>;
  onTypeClick?: (typeId: CompTypeId | 'all') => void;
  onStatusClick?: (statusId: CompStatusId) => void;
};

function TypeIcon({ typeId }: { typeId: string }) {
  switch (typeId) {
    case 'vip':
      return <IconStar />;
    case 'backstage':
      return <IconUsers />;
    case 'open_bar':
      return <IconDrink />;
    case 'vip_table':
      return <IconCrown />;
    default:
      return <IconSpark />;
  }
}

export function EventCompsOverviewPanel({
  typeCounts,
  statusCounts,
  activeType = 'all',
  statusFilters = new Set(),
  onTypeClick,
  onStatusClick,
}: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <section className="event-comps-overview">
      <div className="event-comps-overview__types">
        <header className="event-comps-overview__heading">
          <strong>{t('eventComps.typesTitle')}</strong>
        </header>
        <div className="event-comps-overview__type-grid">
          {COMP_TYPES.map((type) => {
            const isActive = activeType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                className={`event-comps-overview__type-card${isActive ? ' event-comps-overview__type-card--active' : ''}`}
                onClick={() => onTypeClick?.(isActive ? 'all' : type.id)}
              >
                <span
                  className="event-comps-overview__type-icon"
                  style={{ backgroundColor: `${type.color}22`, color: type.color }}
                >
                  <TypeIcon typeId={type.id} />
                </span>
                <strong>{t(`eventComps.types.${type.id}`)}</strong>
                <span>{new Intl.NumberFormat(numberLocale).format(typeCounts[type.id] ?? 0)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="event-comps-overview__statuses">
        <header className="event-comps-overview__heading">
          <strong>{t('eventComps.statusTitle')}</strong>
          <button type="button" className="event-comps-overview__info" aria-label={t('eventComps.statusInfo')}>
            <IconInfo />
          </button>
        </header>
        <div className="event-comps-overview__status-grid">
          {COMP_STATUSES.map((status) => {
            const isActive = statusFilters.has(status);
            return (
              <button
                key={status}
                type="button"
                className={`event-comps-status-legend event-comps-status-legend--${status}${isActive ? ' event-comps-status-legend--active' : ''}`}
                onClick={() => onStatusClick?.(status)}
              >
                <span className="event-comps-status-legend__dot" aria-hidden="true" />
                <span className="event-comps-status-legend__label">{t(`eventComps.status.${status}`)}</span>
                <strong className="event-comps-status-legend__count">
                  {new Intl.NumberFormat(numberLocale).format(statusCounts[status] ?? 0)}
                </strong>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
