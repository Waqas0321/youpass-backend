import { useI18n } from '../../i18n/useI18n';
import { IconDownload, IconSmartphone, IconUpload, IconUsers } from '../ui/Icons';

type Props = {
  selectedCount: number;
  onImport: () => void;
  onWhatsApp: () => void;
  onGenerateLinks: () => void;
  onExport: () => void;
};

export function EventInvitationsBulkBar({
  selectedCount,
  onImport,
  onWhatsApp,
  onGenerateLinks,
  onExport,
}: Props) {
  const { t } = useI18n();

  return (
    <footer className="event-invitations-bulk">
      <div className="event-invitations-bulk__left">
        <IconUsers className="event-invitations-bulk__icon" />
        <div>
          <strong>{t('eventInvitations.bulkTitle')}</strong>
          {selectedCount > 0 ? (
            <span>{t('eventInvitations.bulkSelected', { count: selectedCount })}</span>
          ) : null}
        </div>
      </div>
      <div className="event-invitations-bulk__actions">
        <button type="button" className="event-invitations-bulk__btn event-invitations-bulk__btn--green" onClick={onImport}>
          <IconUpload />
          {t('eventInvitations.bulk.import')}
        </button>
        <button type="button" className="event-invitations-bulk__btn event-invitations-bulk__btn--green" onClick={onWhatsApp}>
          <IconSmartphone />
          {t('eventInvitations.bulk.whatsapp')}
        </button>
        <button type="button" className="event-invitations-bulk__btn event-invitations-bulk__btn--purple" onClick={onGenerateLinks}>
          {t('eventInvitations.bulk.links')}
        </button>
        <button type="button" className="event-invitations-bulk__btn event-invitations-bulk__btn--export" onClick={onExport}>
          <IconDownload />
          {t('eventInvitations.bulk.export')}
        </button>
      </div>
    </footer>
  );
}
