import { IconX } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  open: boolean;
  staffName: string;
  pin: string;
  mode?: 'view' | 'reset';
  onClose: () => void;
};

export function StaffSupervisorPinModal({
  open,
  staffName,
  pin,
  mode = 'view',
  onClose,
}: Props) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  const title =
    mode === 'reset' ? t('staffQr.supervisorPinResetModalTitle') : t('staffQr.supervisorPinModalTitle');
  const hint =
    mode === 'reset' ? t('staffQr.supervisorPinResetModalHint') : t('staffQr.supervisorPinModalHint');

  return (
    <div className="staff-qr-modal-backdrop" onClick={onClose}>
      <div
        className="staff-qr-modal staff-qr-modal--pin-preview"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="staff-qr-modal__header">
          <div>
            <h3>{title}</h3>
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
        <div className="staff-qr-pin-preview">
          <p className="staff-qr-pin-preview__label">{t('staffQr.supervisorPinModalLabel')}</p>
          <strong className="staff-qr-pin-preview__value" aria-label={pin}>
            {pin}
          </strong>
          <p className="staff-qr-pin-preview__hint">{hint}</p>
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
