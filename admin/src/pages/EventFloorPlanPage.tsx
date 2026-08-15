import { useEffect, useState } from 'react';
import { EventFloorPlanEditModal } from '../components/event-floor-plan/EventFloorPlanEditModal';
import { EventFloorPlanMap } from '../components/event-floor-plan/EventFloorPlanMap';
import { EventFloorPlanPreviewModal } from '../components/event-floor-plan/EventFloorPlanPreviewModal';
import { EventFloorPlanZonesPanel } from '../components/event-floor-plan/EventFloorPlanZonesPanel';
import { EventVipSetupFlow } from '../components/event-vip-setup/EventVipSetupFlow';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { useEventWorkspaceEvent } from '../components/event-workspace/useEventWorkspaceEvent';
import { useEventVipSetupStatus } from '../hooks/useEventVipSetupStatus';
import { useSelectedEvent } from '../context/SelectedEventContext';
import { Alert } from '../components/ui/Alert';
import { IconEdit, IconSmartphone } from '../components/ui/Icons';
import { useI18n } from '../i18n/useI18n';

function resolveActiveStep(hasMapImage: boolean, zoneCount: number): 1 | 2 | 3 {
  if (zoneCount > 0) {
    return 3;
  }

  return hasMapImage ? 2 : 1;
}

export function EventFloorPlanPage() {
  const { t } = useI18n();
  const { eventId, event } = useEventWorkspaceEvent();
  const { refreshEvents } = useSelectedEvent();
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [layoutImageUrl, setLayoutImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const setup = useEventVipSetupStatus(eventId, layoutImageUrl);

  useEffect(() => {
    setLayoutImageUrl(event?.floor_plan_image_url ?? null);
  }, [event?.floor_plan_image_url, eventId]);

  const activeStep = resolveActiveStep(setup.hasMapImage, setup.zoneCount);

  const headerActions = (
    <div className="event-workspace__header-action-group">
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--ghost"
        onClick={() => setEditOpen(true)}
      >
        <IconEdit />
        {t('eventFloorPlan.editMap')}
      </button>
      <button
        type="button"
        className="event-workspace__btn event-workspace__btn--primary"
        onClick={() => setPreviewOpen(true)}
      >
        <IconSmartphone />
        {t('eventFloorPlan.previewApp')}
      </button>
    </div>
  );

  return (
    <EventWorkspacePage
      pageTitle={t('eventFloorPlan.title')}
      pageSubtitle={t('eventFloorPlan.subtitle')}
      headerActions={headerActions}
      loadingLabel={t('eventFloorPlan.loading')}
      notFoundLabel={t('eventFloorPlan.notFound')}
    >
      <div className={`event-floor-plan${editOpen ? ' event-floor-plan--dimmed' : ''}`}>
        {message ? <Alert tone="success">{message}</Alert> : null}

        <EventVipSetupFlow
          eventId={eventId}
          activeStep={activeStep}
          hasMapImage={setup.hasMapImage}
          zoneCount={setup.zoneCount}
          tableCount={setup.tableCount}
        />

        <section className="event-floor-plan__section">
          <header className="event-floor-plan__section-header">
            <h2>{t('eventFloorPlan.mapSectionTitle')}</h2>
            <p>{t('eventFloorPlan.mapSectionBody')}</p>
          </header>
          <EventFloorPlanMap
            imageUrl={layoutImageUrl}
            emptyTitle={t('eventFloorPlan.emptyTitle')}
            emptyBody={t('eventFloorPlan.emptyBody')}
          />
        </section>

        <EventFloorPlanZonesPanel
          eventId={eventId}
          event={event}
          onChanged={() => void setup.reloadSetup()}
        />
      </div>

      <EventFloorPlanEditModal
        open={editOpen}
        eventId={eventId}
        onClose={() => setEditOpen(false)}
        onSaved={(url) => {
          setLayoutImageUrl(url);
          setMessage(t('eventFloorPlan.saveSuccess'));
          void refreshEvents();
          void setup.reloadSetup();
        }}
      />

      <EventFloorPlanPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageUrl={layoutImageUrl}
        eventTitle={event?.title ?? ''}
      />
    </EventWorkspacePage>
  );
}
