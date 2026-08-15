import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';

type EventInfoAppPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  bannerUrl?: string;
  logoUrl?: string;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  primaryColor: string;
};

export function EventInfoAppPreviewModal({
  open,
  onClose,
  title,
  bannerUrl,
  logoUrl,
  dateLabel,
  timeLabel,
  locationLabel,
  primaryColor,
}: EventInfoAppPreviewModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventInfo.appPreview')}
      subtitle={t('eventInfo.appPreviewSubtitle')}
      closeLabel={t('common.close')}
      contentClassName="modal__panel event-info-preview-modal"
    >
      <article className="event-info-preview">
        <div className="event-info-preview__banner">
          {bannerUrl ? <img src={bannerUrl} alt="" /> : <div className="event-info-preview__banner-fallback" />}
          {logoUrl ? (
            <img src={logoUrl} alt="" className="event-info-preview__logo" />
          ) : null}
        </div>
        <div className="event-info-preview__body">
          <span className="event-info-preview__badge" style={{ background: primaryColor }}>
            {t('eventsPage.badge.upcoming')}
          </span>
          <h3>{title || t('eventInfo.eventNamePlaceholder')}</h3>
          <p>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}</p>
          <p>{locationLabel || t('eventInfo.locationPending')}</p>
        </div>
      </article>
    </Modal>
  );
}
