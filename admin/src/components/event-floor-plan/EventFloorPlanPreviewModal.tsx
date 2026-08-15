import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  open: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  eventTitle: string;
};

export function EventFloorPlanPreviewModal({ open, onClose, imageUrl, eventTitle }: Props) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventFloorPlan.previewModal.title')}
      subtitle={t('eventFloorPlan.previewModal.subtitle')}
      closeLabel={t('common.close')}
      contentClassName="modal__panel event-floor-plan-preview-modal"
    >
      <article className="event-floor-plan-preview">
        <header className="event-floor-plan-preview__header">
          <strong>{eventTitle}</strong>
          <span>{t('eventFloorPlan.previewModal.label')}</span>
        </header>
        <div className="event-floor-plan-preview__screen">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="event-floor-plan-preview__image" />
          ) : (
            <p className="event-floor-plan-preview__empty">{t('eventFloorPlan.emptyTitle')}</p>
          )}
        </div>
      </article>
    </Modal>
  );
}
