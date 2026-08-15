import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { getProducerEvent } from './eventCatalog';
import { EventDetailHeader } from './components/EventDetailHeader';
import { EventDetailMetaGrid } from './components/EventDetailMetaGrid';
import { EventProducerContacts } from './components/EventProducerContacts';
import { EventSalesPanel } from './components/EventSalesPanel';

type Props = {
  open: boolean;
  eventId: string | null;
  onClose: () => void;
};

export function EventDetailModal({ open, eventId, onClose }: Props) {
  const { locale, t } = useI18n();
  const event = eventId ? getProducerEvent(eventId) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventDetail.title')}
      closeLabel={t('calendar.closeModal')}
      panelClassName="producer-modal__panel--event-detail"
    >
      {!event ? (
        <div className="prod-event-detail prod-event-detail--modal prod-event-detail--empty">
          <h3>{t('eventDetail.notFoundTitle')}</h3>
          <p>{t('eventDetail.notFoundDescription')}</p>
        </div>
      ) : (
        <article className="prod-event-detail prod-event-detail--modal" key={locale}>
          <EventDetailHeader event={event} />
          <EventDetailMetaGrid event={event} />
          <EventSalesPanel event={event} />
          <EventProducerContacts contacts={event.contacts} />
        </article>
      )}
    </Modal>
  );
}
