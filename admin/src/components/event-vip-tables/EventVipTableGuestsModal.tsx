import { useI18n } from '../../i18n/useI18n';
import { useVipTableGuests } from '../../hooks/useVipTableGuests';
import { LoadingBlock } from '../ui/LoadingBlock';
import { Modal } from '../ui/Modal';
import { IconInfo } from '../ui/Icons';
import { EventVipTableGuestsList } from './EventVipTableGuestsList';
import { EventVipTableGuestsSummary } from './EventVipTableGuestsSummary';
import type { EventVipTableRow } from './eventVipTablesData';

type Props = {
  open: boolean;
  eventId: string;
  table: EventVipTableRow | null;
  onClose: () => void;
};

export function EventVipTableGuestsModal({ open, eventId, table, onClose }: Props) {
  const { t } = useI18n();
  const { guests, buyer, loading, error, cancelGuest } = useVipTableGuests(eventId, table, open);

  if (!table) {
    return null;
  }

  const assignedCount = guests.filter((guest) => guest.slotStatus !== 'empty').length;

  const footer = (
    <>
      <p className="event-vip-table-guests-modal__footer-note">
        <IconInfo aria-hidden />
        <span>{t('eventVipTables.guestsModal.footerNote')}</span>
      </p>
      <button type="button" className="event-vip-table-guests-modal__close-btn" onClick={onClose}>
        {t('eventVipTables.guestsModal.close')}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventVipTables.guestsModal.title')}
      closeLabel={t('eventVipTables.guestsModal.close')}
      titleId="event-vip-table-guests-title"
      contentClassName="event-vip-table-guests-modal"
      backdropClassName="modal__backdrop"
      error={error}
      footer={footer}
    >
      <EventVipTableGuestsSummary table={table} buyer={buyer ?? table.buyer ?? null} />
      {loading ? (
        <LoadingBlock label={t('eventVipTables.guestsModal.loading')} />
      ) : (
        <EventVipTableGuestsList
          guests={guests}
          capacity={table.capacity}
          assignedCount={assignedCount}
          onCancelGuest={(guestId) => void cancelGuest(guestId)}
        />
      )}
    </Modal>
  );
}
