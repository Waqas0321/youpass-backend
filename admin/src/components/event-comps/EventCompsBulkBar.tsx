import { useI18n } from '../../i18n/useI18n';
import { IconDownload, IconPlus, IconSmartphone, IconUpload, IconUsers } from '../ui/Icons';

type Props = {
  onCreateBatch: () => void;
  onImport: () => void;
  onWhatsApp: () => void;
  onExport: () => void;
};

export function EventCompsBulkBar({ onCreateBatch, onImport, onWhatsApp, onExport }: Props) {
  const { t } = useI18n();

  return (
    <footer className="event-comps-bulk">
      <div className="event-comps-bulk__left">
        <IconUsers className="event-comps-bulk__icon" />
        <strong>{t('eventComps.bulkTitle')}</strong>
      </div>
      <div className="event-comps-bulk__actions">
        <button type="button" className="event-comps-bulk__btn event-comps-bulk__btn--purple" onClick={onCreateBatch}>
          <IconPlus />
          {t('eventComps.bulk.createBatch')}
        </button>
        <button type="button" className="event-comps-bulk__btn event-comps-bulk__btn--green" onClick={onImport}>
          <IconUpload />
          {t('eventComps.bulk.import')}
        </button>
        <button type="button" className="event-comps-bulk__btn event-comps-bulk__btn--green" onClick={onWhatsApp}>
          <IconSmartphone />
          {t('eventComps.bulk.whatsapp')}
        </button>
        <button type="button" className="event-comps-bulk__btn event-comps-bulk__btn--export" onClick={onExport}>
          <IconDownload />
          {t('eventComps.bulk.export')}
        </button>
      </div>
    </footer>
  );
}
