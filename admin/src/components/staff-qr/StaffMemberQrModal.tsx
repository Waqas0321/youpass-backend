import { IconX } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  open: boolean;
  staffName: string;
  qrImage: string;
  onClose: () => void;
};

export function StaffMemberQrModal({ open, staffName, qrImage, onClose }: Props) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="staff-qr-modal-backdrop" onClick={onClose}>
      <div className="staff-qr-modal staff-qr-modal--qr-preview" onClick={(event) => event.stopPropagation()}>
        <header className="staff-qr-modal__header">
          <div>
            <h3>{t('staffQr.qrModalTitle')}</h3>
            <p className="staff-qr-modal__subtitle">{staffName}</p>
          </div>
          <button
            type="button"
            className="staff-qr-modal__close"
            onClick={onClose}
            aria-label={t('staffQr.closeModal')}
          >
            <IconX />
          </button>
        </header>
        <div className="staff-qr-preview">
          <img src={qrImage} alt={t('staffQr.qrModalAlt', { name: staffName })} className="staff-qr-preview__image" />
          <p className="staff-qr-preview__hint">{t('staffQr.qrModalHint')}</p>
        </div>
        <footer className="staff-qr-modal__footer staff-qr-modal__footer--single">
          <button type="button" className="primary-btn" onClick={onClose}>
            {t('staffQr.closeModal')}
          </button>
        </footer>
      </div>
    </div>
  );
}
