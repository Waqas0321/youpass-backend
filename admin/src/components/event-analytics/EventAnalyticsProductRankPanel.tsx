import { useI18n } from '../../i18n/useI18n';
import type { AnalyticsRank } from './buildEventAnalyticsView';
import { PRODUCT_RANK_PHOTOS } from './eventAnalyticsDemoAssets';

type Props = {
  title: string;
  subtitle: string;
  emptyLabel: string;
  items: AnalyticsRank[];
};

export function EventAnalyticsProductRankPanel({ title, subtitle, emptyLabel, items }: Props) {
  const { t, numberLocale } = useI18n();

  return (
    <article className="event-analytics__panel event-analytics__panel--product-rank">
      <header className="event-analytics__panel-header event-analytics__panel-header--compact">
        <h3>{title}</h3>
      </header>

      {items.length === 0 ? (
        <p className="event-analytics__empty">{emptyLabel}</p>
      ) : (
        <div className="event-analytics-product-rank__inner">
          <p className="event-analytics-product-rank__subtitle">{subtitle}</p>

          <ol className="event-analytics-product-rank__list">
            {items.map((item, index) => (
              <li key={item.name}>
                <span className="event-analytics-product-rank__index">{index + 1}</span>
                <img
                  className="event-analytics-product-rank__avatar"
                  src={PRODUCT_RANK_PHOTOS[index % PRODUCT_RANK_PHOTOS.length]}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <strong className="event-analytics-product-rank__name">{item.name}</strong>
                <span className="event-analytics-product-rank__count">
                  {new Intl.NumberFormat(numberLocale).format(item.count)}
                </span>
              </li>
            ))}
          </ol>

          <button type="button" className="event-analytics-product-rank__view-all" disabled>
            {t('eventAnalytics.viewAllArrow')}
          </button>
        </div>
      )}
    </article>
  );
}
