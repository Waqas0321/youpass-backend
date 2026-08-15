import type { TopProduct } from './reportsDemo';
import { formatCount } from '../dashboard/dashboardChartUtils';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  products: TopProduct[];
};

export function ReportsTopProductsPanel({ products }: Props) {
  const { locale, t, numberLocale } = useI18n();

  return (
    <article className="prod-reports-panel prod-reports-panel--products" key={locale}>
      <header className="prod-reports-panel__header">
        <h2>{t('reports.topProductsTitle')}</h2>
      </header>
      <div className="prod-reports-products-table-wrap">
        <table className="prod-reports-products-table">
          <thead>
            <tr>
              <th scope="col">{t('reports.colProduct')}</th>
              <th scope="col">{t('reports.colUnitsSold')}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.id}>
                <td>
                  <span className="prod-reports-products-table__rank">{index + 1}</span>
                  <span>{product.name}</span>
                </td>
                <td>{formatCount(product.unitsSold, numberLocale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
