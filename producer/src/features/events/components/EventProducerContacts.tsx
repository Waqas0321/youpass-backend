import type { EventContact } from '../types';
import { IconPhone } from '../../../components/ui/Icons';
import { useI18n } from '../../../i18n/useI18n';

type Props = {
  contacts: EventContact[];
};

export function EventProducerContacts({ contacts }: Props) {
  const { t } = useI18n();

  return (
    <section className="prod-event-detail__contacts">
      <h2>{t('eventDetail.generalProducers')}</h2>
      <div className="prod-event-detail__contact-grid">
        {contacts.map((contact) => (
          <article key={contact.id} className="prod-event-detail__contact-card">
            <span className="prod-event-detail__contact-avatar">{contact.initials}</span>
            <div className="prod-event-detail__contact-copy">
              <strong>{contact.name}</strong>
              <span>{contact.phone}</span>
            </div>
            <a
              href={`tel:${contact.phone.replace(/\s/g, '')}`}
              className="prod-event-detail__contact-call"
              aria-label={t('eventDetail.callProducer', { name: contact.name })}
            >
              <IconPhone />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
