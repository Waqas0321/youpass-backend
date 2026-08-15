import { useI18n } from '../../i18n/useI18n';
import type { AnalyticsRank } from './buildEventAnalyticsView';

type Props = {
  title: string;
  emptyLabel: string;
  items: AnalyticsRank[];
  showAvatar?: boolean;
};

export function EventAnalyticsRankList({ title, emptyLabel, items, showAvatar = false }: Props) {
  const { t, numberLocale } = useI18n();
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <article className="event-analytics__panel">
      <header className="event-analytics__panel-header">
        <h3>{title}</h3>
        <button type="button" className="event-analytics__view-all" disabled>
          {t('eventAnalytics.viewAll')}
        </button>
      </header>
      {items.length === 0 ? (
        <p className="event-analytics__empty">{emptyLabel}</p>
      ) : (
        <ol className="event-analytics__rank-list">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {showAvatar ? (
                <span className="event-analytics__avatar">
                  {item.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('')}
                </span>
              ) : (
                <span className="event-analytics__rank-index">{index + 1}</span>
              )}
              <div className="event-analytics__rank-body">
                <div className="event-analytics__rank-row">
                  <strong>{item.name}</strong>
                  <span>{new Intl.NumberFormat(numberLocale).format(item.count)}</span>
                </div>
                <div className="event-analytics__rank-bar">
                  <span style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
