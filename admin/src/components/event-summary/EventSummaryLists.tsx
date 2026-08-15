import { Link } from 'react-router-dom';
import { IconQrCode } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { EventSummaryPurchaseRow, EventSummaryQrRow } from './eventSummaryData';

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type EventSummaryListsProps = {
  eventId: string;
  purchases: EventSummaryPurchaseRow[];
  redemptions: EventSummaryQrRow[];
};

export function EventSummaryLists({
  eventId,
  purchases,
  redemptions,
}: EventSummaryListsProps) {
  const { t } = useI18n();

  return (
    <>
      <article className="event-summary__list-card">
        <header>
          <h3>{t('eventSummary.latestPurchases')}</h3>
          <Link to={`/events/${eventId}/orders`}>{t('eventSummary.viewAll')}</Link>
        </header>
        <ul>
          {purchases.length === 0 ? (
            <li className="event-summary__empty">{t('dashboard.noRecentActivity')}</li>
          ) : (
            purchases.map((item) => (
              <li key={item.id} className="event-summary__list-row">
                <span className="event-summary__avatar" aria-hidden="true">
                  {initialsFromName(item.name)}
                </span>
                <div className="event-summary__list-main">
                  <strong>{item.name}</strong>
                  <span>{item.product}</span>
                </div>
                <div className="event-summary__list-end">
                  <span className="event-summary__list-time">{item.timeLabel}</span>
                  <strong className="event-summary__list-price">{item.price}</strong>
                </div>
              </li>
            ))
          )}
        </ul>
      </article>

      <article className="event-summary__list-card">
        <header>
          <h3>{t('eventSummary.latestQrRedemptions')}</h3>
          <Link to={`/events/${eventId}/staff-qr`}>{t('eventSummary.viewAll')}</Link>
        </header>
        <ul>
          {redemptions.length === 0 ? (
            <li className="event-summary__empty">{t('eventSummary.noQrActivity')}</li>
          ) : (
            redemptions.map((item) => (
              <li key={item.id} className="event-summary__list-row">
                <span
                  className={`event-summary__qr-icon ${
                    item.valid ? 'event-summary__qr-icon--valid' : 'event-summary__qr-icon--invalid'
                  }`}
                  aria-hidden="true"
                >
                  <IconQrCode />
                </span>
                <div className="event-summary__list-main">
                  <strong>{item.name}</strong>
                  <span>{item.accessType}</span>
                </div>
                <div className="event-summary__list-end">
                  <span className="event-summary__list-time">{item.timeLabel}</span>
                  <span
                    className={`event-summary__qr-pill ${
                      item.valid ? 'event-summary__qr-pill--valid' : 'event-summary__qr-pill--invalid'
                    }`}
                  >
                    {item.valid ? t('eventSummary.qrValid') : t('eventSummary.qrInvalid')}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </article>
    </>
  );
}
