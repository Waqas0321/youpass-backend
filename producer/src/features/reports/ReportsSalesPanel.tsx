import type { ProducerEvent } from '../events/types';
import {
  categorySoldPct,
  computeSalesSummary,
  donutSlicesFromCategories,
} from '../events/eventDetail.utils';
import { buildDonutSegments, formatCount, formatPercent } from '../dashboard/dashboardChartUtils';
import { IconUsers } from '../../components/ui/Icons';
import { ticketCategoryLabel } from '../../i18n/localize';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  event: ProducerEvent;
};

const DONUT_SIZE = 140;
const DONUT_RADIUS = 58;

function categoryShareOfEvent(sold: number, capacity: number) {
  if (capacity <= 0) {
    return 0;
  }
  return (sold / capacity) * 100;
}

export function ReportsSalesPanel({ event }: Props) {
  const { locale, t, numberLocale } = useI18n();
  const summary = computeSalesSummary(event);
  const slices = donutSlicesFromCategories(event).map((slice) => ({
    label: slice.label,
    value: slice.value,
    color: slice.color,
  }));
  const segments = buildDonutSegments(slices, DONUT_RADIUS);
  const soldPctLabel = formatPercent(summary.soldPct, numberLocale);
  const availablePctLabel = formatPercent(summary.availablePct, numberLocale);

  return (
    <section className="prod-reports-sales" key={locale}>
      <header className="prod-reports-sales__header">
        <h2>{t('eventDetail.salesStatusTitle')}</h2>
        <span
          className={
            event.salesStatus === 'active'
              ? 'prod-reports-sales__badge prod-reports-sales__badge--active'
              : 'prod-reports-sales__badge prod-reports-sales__badge--paused'
          }
        >
          {event.salesStatus === 'active' ? t('eventDetail.salesActive') : t('eventDetail.salesPaused')}
        </span>
      </header>

      <div className="prod-reports-sales__body-scroll">
        <div className="prod-reports-sales__body">
          <div className="prod-reports-sales__stats">
            <div className="prod-reports-sales__stat">
              <span>{t('eventDetail.totalTicketsSold')}</span>
              <strong>
                {t('eventDetail.ticketsSoldSummary', {
                  sold: formatCount(event.ticketsSold, numberLocale),
                  total: formatCount(event.capacity, numberLocale),
                })}
              </strong>
            </div>
            <div className="prod-reports-sales__stat">
              <span>{t('eventDetail.percentSold')}</span>
              <strong>{soldPctLabel}%</strong>
            </div>
            <div className="prod-reports-sales__stat">
              <span>{t('eventDetail.availableTickets')}</span>
              <strong>
                {t('eventDetail.availableSummary', {
                  count: formatCount(summary.available, numberLocale),
                  pct: availablePctLabel,
                })}
              </strong>
            </div>
          </div>

          <div className="prod-reports-sales__donut">
            <svg
              width={DONUT_SIZE}
              height={DONUT_SIZE}
              viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
              aria-hidden="true"
            >
              <circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                className="prod-reports-sales__donut-track"
              />
              {segments.map((segment) => (
                <circle
                  key={segment.label}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={DONUT_RADIUS}
                  className="prod-reports-sales__donut-slice"
                  stroke={segment.color}
                  strokeDasharray={`${segment.dash} ${2 * Math.PI * DONUT_RADIUS - segment.dash}`}
                  strokeDashoffset={-segment.offset}
                  transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                />
              ))}
            </svg>
            <div className="prod-reports-sales__donut-center">
              <strong>{soldPctLabel}%</strong>
              <span>{t('eventDetail.donutSoldLabel')}</span>
            </div>
          </div>

          <div className="prod-reports-sales__table-wrap">
            <h3>{t('eventDetail.categoryTableTitle')}</h3>
            <table className="prod-reports-sales__table">
              <thead>
                <tr>
                  <th>{t('eventDetail.colCategory')}</th>
                  <th>{t('eventDetail.colSold')}</th>
                  <th>{t('eventDetail.colTotalAvailable')}</th>
                  <th>{t('reports.colSoldVsCategory')}</th>
                  <th>{t('reports.colShareOfEvent')}</th>
                </tr>
              </thead>
              <tbody>
                {event.ticketCategories
                  .filter((category) => category.total > 0)
                  .map((category) => {
                    const soldVsCategory = categorySoldPct(category.sold, category.total);
                    const shareOfEvent = categoryShareOfEvent(category.sold, event.capacity);

                    return (
                      <tr key={category.id}>
                        <td>
                          <span className="prod-reports-sales__category">
                            <span
                              className="prod-reports-sales__swatch"
                              style={{ background: category.color }}
                            />
                            {ticketCategoryLabel(t, category.id)}
                          </span>
                        </td>
                        <td>{formatCount(category.sold, numberLocale)}</td>
                        <td>{formatCount(category.total, numberLocale)}</td>
                        <td>{formatPercent(soldVsCategory, numberLocale)}%</td>
                        <td>{formatPercent(shareOfEvent, numberLocale)}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="prod-reports-sales__footer">
        <span className="prod-reports-sales__footer-item">
          <IconUsers className="prod-reports-sales__footer-icon" aria-hidden="true" />
          {t('eventDetail.totalCapacityFooter', {
            count: formatCount(event.capacity, numberLocale),
          })}
        </span>
        <span className="prod-reports-sales__footer-highlight">
          {t('eventDetail.availableFooter', {
            count: formatCount(summary.available, numberLocale),
            pct: availablePctLabel,
          })}
        </span>
      </footer>
    </section>
  );
}
