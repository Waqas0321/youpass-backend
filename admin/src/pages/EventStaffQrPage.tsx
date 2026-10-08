import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { StaffQrPanel } from './StaffQrPage';
import { useI18n } from '../i18n/useI18n';

export function EventStaffQrPage() {
  const { eventId = '' } = useParams();
  const { t } = useI18n();
  const [addStaffRequestId, setAddStaffRequestId] = useState(0);

  const requestAddStaff = useCallback(() => {
    setAddStaffRequestId((current) => current + 1);
  }, []);

  return (
    <EventWorkspacePage
      pageTitle={t('staffQr.title')}
      pageSubtitle={t('staffQr.subtitle')}
      loadingLabel={t('staffQr.loading')}
      notFoundLabel={t('staffQr.noEventSelected')}
      headerActions={
        <button type="button" className="primary-btn staff-qr-add-btn" onClick={requestAddStaff}>
          {t('staffQr.addStaff')}
        </button>
      }
    >
      <StaffQrPanel eventId={eventId} embedded addStaffRequestId={addStaffRequestId} />
    </EventWorkspacePage>
  );
}
