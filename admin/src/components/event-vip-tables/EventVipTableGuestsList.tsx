import { IconInfo, IconTrash } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { EventVipTableGuestEntryBadge } from './EventVipTableGuestEntryBadge';
import { formatDisplayPhone, type VipTableGuest } from './eventVipTablesData';

type Props = {
  guests: VipTableGuest[];
  capacity: number;
  assignedCount: number;
  onCancelGuest: (guestId: string) => void;
};

export function EventVipTableGuestsList({ guests, capacity, assignedCount, onCancelGuest }: Props) {
  const { t } = useI18n();

  return (
    <section className="event-vip-table-guests-modal__list-section">
      <h3>
        {t('eventVipTables.guestsModal.registeredTitle', {
          count: String(assignedCount),
          capacity: String(capacity),
        })}
      </h3>

      {assignedCount === 0 ? (
        <p className="event-vip-table-guests-modal__empty-note">{t('eventVipTables.guestsModal.emptyGuests')}</p>
      ) : null}

      <div className="event-vip-table-guests-modal__table-wrap">
        <table className="event-vip-table-guests-modal__table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('eventVipTables.guestsModal.columns.name')}</th>
              <th>{t('eventVipTables.guestsModal.columns.phone')}</th>
              <th>
                <span className="event-vip-table-guests-modal__entry-header">
                  {t('eventVipTables.guestsModal.columns.entryStatus')}
                  <IconInfo aria-hidden />
                </span>
              </th>
              <th>{t('eventVipTables.guestsModal.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest, index) => (
              <tr
                key={guest.id}
                className={guest.slotStatus === 'empty' ? 'event-vip-table-guests-modal__row--empty' : undefined}
              >
                <td>{index + 1}</td>
                <td>{guest.name}</td>
                <td>{formatDisplayPhone(guest.phone)}</td>
                <td>
                  <EventVipTableGuestEntryBadge status={guest.entryStatus} />
                </td>
                <td>
                  {guest.cancellable ? (
                    <button
                      type="button"
                      className="event-vip-table-guests-modal__cancel-entry"
                      onClick={() => onCancelGuest(guest.id)}
                    >
                      <IconTrash />
                      <span>{t('eventVipTables.guestsModal.cancelEntry')}</span>
                    </button>
                  ) : (
                    <span className="event-vip-table-guests-modal__no-action">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
