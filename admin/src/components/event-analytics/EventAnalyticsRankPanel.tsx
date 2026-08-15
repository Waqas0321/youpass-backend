import { useI18n } from '../../i18n/useI18n';
import type { AnalyticsRank } from './buildEventAnalyticsView';
import { VIP_USER_PHOTOS } from './eventAnalyticsDemoAssets';

type Props = {
  title: string;
  emptyLabel: string;
  items: AnalyticsRank[];
  variant: 'tickets' | 'vip';
};

export function EventAnalyticsRankPanel({ title, emptyLabel, items, variant }: Props) {
  const { t, numberLocale } = useI18n();
  const isVip = variant === 'vip';

  return (
    <article
      className={`event-analytics__panel event-analytics-rank-panel event-analytics-rank-panel--${variant}`}
    >
      <header className="event-analytics__panel-header">
        <h3>{title}</h3>
      </header>

      {items.length === 0 ? (
        <p className="event-analytics__empty">{emptyLabel}</p>
      ) : (
        <div className="event-analytics-rank-panel__body">
          <ol className="event-analytics-rank-panel__list">
            {items.map((item, index) => (
              <li key={item.name}>
                <span className="event-analytics-rank-panel__index">{index + 1}</span>
                {isVip ? (
                  <img
                    className="event-analytics-rank-panel__avatar"
                    src={VIP_USER_PHOTOS[index % VIP_USER_PHOTOS.length]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <strong className="event-analytics-rank-panel__name">{item.name}</strong>
                <span className="event-analytics-rank-panel__value">
                  {isVip
                    ? t('eventAnalytics.vipPurchaseCount', {
                        count: new Intl.NumberFormat(numberLocale).format(item.count),
                      })
                    : new Intl.NumberFormat(numberLocale).format(item.count)}
                </span>
              </li>
            ))}
          </ol>

          <button type="button" className="event-analytics-rank-panel__view-all" disabled>
            {t('eventAnalytics.viewAllArrow')}
          </button>
        </div>
      )}
    </article>
  );
}
