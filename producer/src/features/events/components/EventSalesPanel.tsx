import type { ProducerEvent } from '../types';
import {
  categoryShareOfTotal,
  categorySoldPct,
  computeSalesSummary,
  donutSlicesFromCategories,
} from '../eventDetail.utils';
import { buildDonutSegments, formatCount, formatPercent } from '../../dashboard/dashboardChartUtils';
import { ticketCategoryLabel } from '../../../i18n/localize';
import { useI18n } from '../../../i18n/useI18n';

type Props = {
  event: ProducerEvent;
};

export function EventSalesPanel({ event }: Props) {
  const { t, numberLocale } = useI18n();
  const summary = computeSalesSummary(event);
  const slices = donutSlicesFromCategories(event).map((slice) => ({
    label: slice.label,
    value: slice.value,
    color: slice.color,
  }));
  const segments = buildDonutSegments(slices, 58);
  const radius = 58;
  const soldPctLabel = formatPercent(summary.soldPct, numberLocale);
  const availablePctLabel = formatPercent(summary.availablePct, numberLocale);

  return (
    <section className="prod-event-detail__sales">
      <header className="prod-event-detail__sales-header">
        <h2>{t('eventDetail.salesStatusTitle')}</h2>
        <span
          className={
            event.salesStatus === 'active'
              ? 'prod-event-detail__sales-badge prod-event-detail__sales-badge--active'
              : 'prod-event-detail__sales-badge prod-event-detail__sales-badge--paused'
          }
        >
          {event.salesStatus === 'active' ? t('eventDetail.salesActive') : t('eventDetail.salesPaused')}
        </span>
      </header>

      <div className="prod-event-detail__sales-body">
        <div className="prod-event-detail__sales-stats">
          <div className="prod-event-detail__stat">
            <span>{t('eventDetail.totalTicketsSold')}</span>
            <strong>
              {t('eventDetail.ticketsSoldSummary', {
                sold: formatCount(event.ticketsSold, numberLocale),
                total: formatCount(event.capacity, numberLocale),
              })}
            </strong>
          </div>
          <div className="prod-event-detail__stat">
            <span>{t('eventDetail.percentSold')}</span>
            <strong>{soldPctLabel}%</strong>
          </div>
          <div className="prod-event-detail__stat">
            <span>{t('eventDetail.availableTickets')}</span>
            <strong>
              {t('eventDetail.availableSummary', {
                count: formatCount(summary.available, numberLocale),
                pct: availablePctLabel,
              })}
            </strong>
          </div>
        </div>

        <div className="prod-event-detail__donut">
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={radius} className="prod-event-detail__donut-track" />
            {segments.map((segment) => (
              <circle
                key={segment.label}
                cx="70"
                cy="70"
                r={radius}
                className="prod-event-detail__donut-slice"
                stroke={segment.color}
                strokeDasharray={`${segment.dash} ${2 * Math.PI * radius - segment.dash}`}
                strokeDashoffset={-segment.offset}
                transform="rotate(-90 70 70)"
              />
            ))}
          </svg>
          <div className="prod-event-detail__donut-center">
            <strong>{soldPctLabel}%</strong>
            <span>{t('eventDetail.donutSoldLabel')}</span>
          </div>
        </div>

        <div className="prod-event-detail__table-wrap">
          <h3>{t('eventDetail.categoryTableTitle')}</h3>
          <table className="prod-event-detail__table">
            <thead>
              <tr>
                <th>{t('eventDetail.colCategory')}</th>
                <th>{t('eventDetail.colSold')}</th>
                <th>{t('eventDetail.colTotalAvailable')}</th>
                <th>{t('eventDetail.colSoldVsTotal')}</th>
                <th>{t('eventDetail.colShareOfSold')}</th>
              </tr>
            </thead>
            <tbody>
              {event.ticketCategories.map((category) => {
                const soldVsTotal = categorySoldPct(category.sold, category.total);
                const shareOfSold = categoryShareOfTotal(category.sold, event.ticketsSold);

                return (
                  <tr key={category.id}>
                    <td>
                      <span className="prod-event-detail__table-category">
                        <span
                          className="prod-event-detail__table-swatch"
                          style={{ background: category.color }}
                        />
                        {ticketCategoryLabel(t, category.id)}
                      </span>
                    </td>
                    <td>{formatCount(category.sold, numberLocale)}</td>
                    <td>{formatCount(category.total, numberLocale)}</td>
                    <td>{formatPercent(soldVsTotal, numberLocale)}%</td>
                    <td>{formatPercent(shareOfSold, numberLocale)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="prod-event-detail__sales-footer">
        <span>
          {t('eventDetail.totalCapacityFooter', {
            count: formatCount(event.capacity, numberLocale),
          })}
        </span>
        <span className="prod-event-detail__sales-footer-highlight">
          {t('eventDetail.availableFooter', {
            count: formatCount(summary.available, numberLocale),
            pct: availablePctLabel,
          })}
        </span>
      </footer>
    </section>
  );
}
