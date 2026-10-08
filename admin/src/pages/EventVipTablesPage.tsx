import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EventVipSetupFlow } from '../components/event-vip-setup/EventVipSetupFlow';
import { EventVipTableCreateModal } from '../components/event-vip-tables/EventVipTableCreateModal';
import { EventVipTablesStatusLegend } from '../components/event-vip-tables/EventVipTablesStatusLegend';
import { EventVipTablesTable } from '../components/event-vip-tables/EventVipTablesTable';
import { EventWorkspacePage } from '../components/event-workspace/EventWorkspacePage';
import { useEventWorkspaceEvent } from '../components/event-workspace/useEventWorkspaceEvent';
import { useEventVipSetupStatus } from '../hooks/useEventVipSetupStatus';
import { useEventVipTables } from '../hooks/useEventVipTables';
import { Alert } from '../components/ui/Alert';
import { IconLayoutGrid, IconPlus } from '../components/ui/Icons';
import { LoadingBlock } from '../components/ui/LoadingBlock';
import { useI18n } from '../i18n/useI18n';

function resolveActiveStep(hasMapImage: boolean, zoneCount: number): 1 | 2 | 3 {
  if (!hasMapImage) {
    return 1;
  }
  if (zoneCount === 0) {
    return 2;
  }
  return 3;
}

export function EventVipTablesPage() {
  const { eventId = '' } = useParams();
  const { event } = useEventWorkspaceEvent();
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState('');
  const setup = useEventVipSetupStatus(eventId, event?.floor_plan_image_url);
  const {
    tables,
    currency,
    zonesReady,
    zones,
    loading,
    ensuringLayout,
    error,
    reload,
    ensureLayout,
  } = useEventVipTables(eventId);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const activeStep = resolveActiveStep(setup.hasMapImage, setup.zoneCount);
  const showSetupGate = !zonesReady;

  const headerActions = zonesReady ? (
    <button
      type="button"
      className="event-workspace__btn event-workspace__btn--primary"
      onClick={() => setCreateOpen(true)}
    >
      <IconPlus />
      {t('eventVipTables.createTable')}
    </button>
  ) : null;

  async function handleEnsureLayout() {
    const ok = await ensureLayout();
    if (ok) {
      await setup.reloadSetup();
    }
  }

  return (
    <>
      <EventWorkspacePage
        pageTitle={t('eventVipTables.title')}
        pageSubtitle={t('eventVipTables.subtitle')}
        headerActions={headerActions}
        loadingLabel={t('eventVipTables.loading')}
        notFoundLabel={t('eventVipTables.notFound')}
      >
        {loading || setup.loading ? (
          <LoadingBlock label={t('eventVipTables.loading')} />
        ) : (
          <div className="event-vip-tables-page">
            {message ? <Alert tone="success">{message}</Alert> : null}
            {error ? <Alert tone="error">{error}</Alert> : null}

            <EventVipSetupFlow
              eventId={eventId}
              activeStep={activeStep}
              hasMapImage={setup.hasMapImage}
              zoneCount={setup.zoneCount}
              tableCount={setup.tableCount}
            />

            {showSetupGate ? (
              <section className="event-vip-tables__empty">
                <span className="event-vip-tables__empty-icon" aria-hidden>
                  <IconLayoutGrid />
                </span>
                <h2>{t('eventVipTables.emptyTitle')}</h2>
                <p>{t('eventVipTables.emptyBody')}</p>
                <div className="event-vip-tables__empty-actions">
                  <Link
                    to={`/events/${eventId}/floor-plan`}
                    className="event-workspace__btn event-workspace__btn--primary"
                  >
                    {t('eventVipTables.goToEventMap')}
                  </Link>
                  <button
                    type="button"
                    className="event-workspace__btn event-workspace__btn--ghost"
                    disabled={ensuringLayout}
                    onClick={() => void handleEnsureLayout()}
                  >
                    {ensuringLayout
                      ? t('eventVipTables.setupLayoutLoading')
                      : t('eventVipTables.setupLayout')}
                  </button>
                </div>
                <p className="event-vip-tables__empty-hint">{t('eventVipTables.setupLayoutHint')}</p>
              </section>
            ) : (
              <div className="event-vip-tables">
                {tables.length === 0 ? (
                  <div className="event-vip-tables__no-tables">
                    <p>{t('eventVipTables.noTablesYet')}</p>
                    <button
                      type="button"
                      className="event-workspace__btn event-workspace__btn--primary"
                      onClick={() => setCreateOpen(true)}
                    >
                      <IconPlus />
                      {t('eventVipTables.createFirstTable')}
                    </button>
                  </div>
                ) : null}
                <EventVipTablesStatusLegend />
                <EventVipTablesTable
                  eventId={eventId}
                  tables={tables}
                  zones={zones}
                  onChanged={() => {
                    void reload();
                    void setup.reloadSetup();
                  }}
                  onActionMessage={setMessage}
                />
              </div>
            )}
          </div>
        )}
      </EventWorkspacePage>

      <EventVipTableCreateModal
        open={createOpen}
        eventId={eventId}
        zones={zones}
        currency={currency}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setMessage(t('eventVipTables.createSuccess'));
          void reload();
          void setup.reloadSetup();
        }}
      />
    </>
  );
}
