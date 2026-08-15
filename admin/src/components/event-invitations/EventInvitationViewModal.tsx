import type { ProducerInvitation } from '../../api/client';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import {
  formatEntryDateTime,
  resolveInvitationDisplayStatus,
  resolveProductDisplay,
  resolveQrDisplayStatus,
} from './eventInvitationsUtils';

type Props = {
  open: boolean;
  invitation: ProducerInvitation | null;
  onClose: () => void;
};

export function EventInvitationViewModal({ open, invitation, onClose }: Props) {
  const { t, dateLocale } = useI18n();

  if (!invitation) {
    return null;
  }

  const displayStatus = resolveInvitationDisplayStatus(invitation);
  const qrStatus = resolveQrDisplayStatus(invitation);
  const product = resolveProductDisplay(invitation);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInvitations.viewModal.title')}
      subtitle={invitation.recipient_name ?? t('eventInvitations.unknownGuest')}
      closeLabel={t('eventInvitations.viewModal.close')}
      contentClassName="modal__panel event-invitation-view-modal"
    >
      <dl className="event-invitation-view">
        <div>
          <dt>{t('eventInvitations.columns.phone')}</dt>
          <dd>{invitation.recipient_phone ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('eventInvitations.columns.list')}</dt>
          <dd>{invitation.slot_label ?? invitation.assigned_slot ?? '—'}</dd>
        </div>
        <div>
          <dt>{t('eventInvitations.columns.invitationType')}</dt>
          <dd>{t(`eventInvitations.productTypes.${product}`)}</dd>
        </div>
        <div>
          <dt>{t('eventInvitations.columns.invitationStatus')}</dt>
          <dd>{t(`eventInvitations.status.${displayStatus}`)}</dd>
        </div>
        <div>
          <dt>{t('eventInvitations.columns.qrStatus')}</dt>
          <dd>{t(`eventInvitations.qrStatus.${qrStatus}`)}</dd>
        </div>
        <div>
          <dt>{t('eventInvitations.columns.entryTime')}</dt>
          <dd>{formatEntryDateTime(invitation.entry_at, dateLocale)}</dd>
        </div>
        {invitation.deep_link ? (
          <div className="event-invitation-view__link">
            <dt>{t('eventInvitations.viewModal.claimLink')}</dt>
            <dd>
              <a href={invitation.deep_link} target="_blank" rel="noreferrer">
                {invitation.deep_link}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </Modal>
  );
}
