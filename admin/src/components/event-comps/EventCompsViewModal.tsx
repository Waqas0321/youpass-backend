import type { Comp } from './eventCompsUtils';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n/useI18n';
import { formatCompDate, formatCompDateTime } from './eventCompsUtils';

type Props = {
  open: boolean;
  comp: Comp | null;
  onClose: () => void;
};

export function EventCompsViewModal({ open, comp, onClose }: Props) {
  const { t, dateLocale } = useI18n();

  if (!comp) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('eventComps.viewModal.title')}
      subtitle={comp.code}
      closeLabel={t('eventComps.viewModal.close')}
      contentClassName="modal__panel event-comps-view-modal"
    >
      <dl className="event-invitation-view">
        <div>
          <dt>{t('eventComps.columns.beneficiary')}</dt>
          <dd>{comp.beneficiary_name}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.phone')}</dt>
          <dd>{comp.phone}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.type')}</dt>
          <dd>{t(`eventComps.types.${comp.type}`)}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.benefit')}</dt>
          <dd>{comp.benefit}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.qrStatus')}</dt>
          <dd>{t(`eventComps.status.${comp.status}`)}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.createdAt')}</dt>
          <dd>{formatCompDate(comp.created_at, dateLocale)}</dd>
        </div>
        <div>
          <dt>{t('eventComps.columns.usedAt')}</dt>
          <dd>{comp.used_at ? formatCompDateTime(comp.used_at, dateLocale) : '—'}</dd>
        </div>
        {comp.issue_date ? (
          <div>
            <dt>{t('eventComps.createModal.fields.issueDate')}</dt>
            <dd>{comp.issue_date}</dd>
          </div>
        ) : null}
        {comp.time_from && comp.time_to ? (
          <div>
            <dt>{t('eventComps.createModal.fields.timeRange')}</dt>
            <dd>
              {comp.time_from} – {comp.time_to}
            </dd>
          </div>
        ) : null}
        {comp.deep_link ? (
          <div className="event-invitation-view__link">
            <dt>{t('eventComps.viewModal.claimLink')}</dt>
            <dd>
              <a href={comp.deep_link} target="_blank" rel="noreferrer">
                {comp.deep_link}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </Modal>
  );
}
