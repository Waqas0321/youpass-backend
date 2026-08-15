import { useI18n } from '../../i18n/useI18n';
import { formatDisplayPhone } from './eventVipTablesData';
import type { EventVipTableRow } from './eventVipTablesData';

type BuyerInfo = {
  name: string;
  phone: string;
  avatarInitials: string;
  avatarUrl?: string;
};

type Props = {
  table: EventVipTableRow;
  buyer: BuyerInfo | null;
};

export function EventVipTableGuestsSummary({ table, buyer }: Props) {
  const { t } = useI18n();

  return (
    <section className="event-vip-table-guests-modal__summary">
      <div className="event-vip-table-guests-modal__summary-item">
        <span>{t('eventVipTables.guestsModal.summary.table')}</span>
        <strong style={{ color: table.zoneColor }}>
          {t('eventVipTables.guestsModal.summary.tableValue', {
            zone: table.zoneLabel,
            number: String(table.number),
          })}
        </strong>
      </div>

      <div className="event-vip-table-guests-modal__summary-item">
        <span>{t('eventVipTables.guestsModal.summary.capacity')}</span>
        <strong>
          {t('eventVipTables.capacityPeople', {
            count: String(table.capacity),
          })}
        </strong>
      </div>

      <div className="event-vip-table-guests-modal__summary-item">
        <span>{t('eventVipTables.guestsModal.summary.status')}</span>
        <strong>
          <span className={`event-vip-tables__status event-vip-tables__status--${table.status}`}>
            {t(`eventVipTables.status.${table.status}`)}
          </span>
        </strong>
      </div>

      <div className="event-vip-table-guests-modal__summary-item event-vip-table-guests-modal__summary-item--buyer">
        <span>{t('eventVipTables.guestsModal.summary.buyer')}</span>
        {buyer ? (
          <div className="event-vip-table-guests-modal__buyer">
            {buyer.avatarUrl ? (
              <img src={buyer.avatarUrl} alt="" className="event-vip-table-guests-modal__buyer-photo" />
            ) : (
              <span className="event-vip-table-guests-modal__buyer-initials">{buyer.avatarInitials}</span>
            )}
            <div>
              <strong>{buyer.name}</strong>
              <small>{formatDisplayPhone(buyer.phone)}</small>
            </div>
          </div>
        ) : (
          <strong className="event-vip-table-guests-modal__buyer-empty">—</strong>
        )}
      </div>
    </section>
  );
}
