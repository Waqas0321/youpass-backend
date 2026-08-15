import type { ReactNode } from 'react';
import { Modal } from '../../components/ui/Modal';
import { IconKey, IconMail, IconTrash, IconUser } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import {
  formatProducerContact,
  getRegisteredProducerDetail,
  type RegisteredProducer,
} from './registeredProducersDemo';

type Props = {
  open: boolean;
  producer: RegisteredProducer | null;
  onClose: () => void;
};

function InfoBlock({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <article className="prod-producer-info-block">
      <div className="prod-producer-info-block__icon">{icon}</div>
      <div className="prod-producer-info-block__body">
        <span className="prod-producer-info-block__label">{label}</span>
        <div className="prod-producer-info-block__value">{children}</div>
      </div>
    </article>
  );
}

export function ProducerInfoModal({ open, producer, onClose }: Props) {
  const { locale, t } = useI18n();

  if (!producer) {
    return null;
  }

  const detail = getRegisteredProducerDetail(producer);

  return (
    <Modal
      key={locale}
      open={open}
      onClose={onClose}
      title={t('registeredProducers.infoModal.title')}
      closeLabel={t('registeredProducers.infoModal.close')}
      panelClassName="producer-modal__panel--producer-info"
      headerLeading={
        <span className="prod-producer-info-modal__avatar" aria-hidden="true">
          <IconUser />
        </span>
      }
      footer={
        <div className="prod-producer-info-modal__footer">
          <button type="button" className="prod-producer-info-modal__delete">
            <IconTrash aria-hidden="true" />
            <span>{t('registeredProducers.infoModal.deleteAccount')}</span>
          </button>
          <button type="button" className="prod-producer-info-modal__close" onClick={onClose}>
            {t('registeredProducers.infoModal.close')}
          </button>
        </div>
      }
    >
      <div className="prod-producer-info-modal__blocks">
        <InfoBlock icon={<IconUser />} label={t('registeredProducers.infoModal.ownerLabel')}>
          <p>{formatProducerContact(detail.owner)}</p>
        </InfoBlock>

        <InfoBlock
          icon={<IconUser />}
          label={t('registeredProducers.infoModal.generalProducersLabel')}
        >
          {detail.generalProducers.map((contact) => (
            <p key={`${contact.name}-${contact.phone}`}>{formatProducerContact(contact)}</p>
          ))}
        </InfoBlock>

        <InfoBlock icon={<IconMail />} label={t('registeredProducers.infoModal.emailLabel')}>
          <p>{detail.email}</p>
        </InfoBlock>

        <InfoBlock icon={<IconKey />} label={t('registeredProducers.infoModal.accessKeyLabel')}>
          <p>{detail.accessKey}</p>
        </InfoBlock>
      </div>
    </Modal>
  );
}
