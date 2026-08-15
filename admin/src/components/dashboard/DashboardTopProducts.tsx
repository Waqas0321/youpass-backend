import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

type ProductRank = {
  id: string;
  name: string;
  count: number;
};

type DashboardTopProductsProps = {
  eventId?: string;
  topProducts: ProductRank[];
};

export function DashboardTopProducts({ eventId, topProducts }: DashboardTopProductsProps) {
  const { t, numberLocale } = useI18n();
  const viewAllHref = eventId ? `/events/${eventId}/drinks` : '/drink-menus';
  const maxCount = Math.max(...topProducts.map((item) => item.count), 1);

  return (
    <article className="dash-panel dash-panel--ranked">
      <header className="dash-panel__header">
        <h3>{t('dashboard.topBarItems')}</h3>
        <Link to={viewAllHref} className="dash-panel__action">
          {t('dashboard.viewAll')}
        </Link>
      </header>
      <ol className="dash-ranked">
        {topProducts.length === 0 ? (
          <li className="dash-ranked__empty">{t('dashboard.noBarData')}</li>
        ) : (
          topProducts.map((item, index) => (
            <li key={item.id} className="dash-ranked__item">
              <span className="dash-ranked__index">{index + 1}</span>
              <div className="dash-ranked__meta">
                <div className="dash-ranked__row">
                  <strong>{item.name}</strong>
                  <span>{new Intl.NumberFormat(numberLocale).format(item.count)}</span>
                </div>
                <div className="dash-ranked__bar">
                  <span style={{ width: `${(item.count / maxCount) * 100}%` }} />
                </div>
              </div>
            </li>
          ))
        )}
      </ol>
    </article>
  );
}
