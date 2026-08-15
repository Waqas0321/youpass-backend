import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  eventId: string;
  activeStep: 1 | 2 | 3;
  hasMapImage: boolean;
  zoneCount: number;
  tableCount: number;
};

type StepKey = 'map' | 'zones' | 'tables';

const STEPS: StepKey[] = ['map', 'zones', 'tables'];

function stepState(index: number, activeStep: number, completed: boolean) {
  const stepNumber = index + 1;
  if (completed) return 'done';
  if (stepNumber === activeStep) return 'current';
  if (stepNumber < activeStep) return 'done';
  return 'upcoming';
}

export function EventVipSetupFlow({
  eventId,
  activeStep,
  hasMapImage,
  zoneCount,
  tableCount,
}: Props) {
  const { t } = useI18n();

  const completed: Record<StepKey, boolean> = {
    map: hasMapImage,
    zones: zoneCount > 0,
    tables: tableCount > 0,
  };

  return (
    <section className="event-vip-setup-flow" aria-label={t('eventVipSetup.title')}>
      <header className="event-vip-setup-flow__header">
        <strong>{t('eventVipSetup.title')}</strong>
        <p>{t('eventVipSetup.subtitle')}</p>
      </header>

      <ol className="event-vip-setup-flow__steps">
        {STEPS.map((key, index) => {
          const state = stepState(index, activeStep, completed[key]);
          const stepNumber = index + 1;

          return (
            <li key={key} className={`event-vip-setup-flow__step event-vip-setup-flow__step--${state}`}>
              <span className="event-vip-setup-flow__badge" aria-hidden>
                {completed[key] ? '✓' : stepNumber}
              </span>
              <div className="event-vip-setup-flow__copy">
                <strong>{t(`eventVipSetup.steps.${key}.title`)}</strong>
                <p>{t(`eventVipSetup.steps.${key}.body`)}</p>
                {key === 'map' && state === 'current' ? (
                  <span className="event-vip-setup-flow__hint">{t('eventVipSetup.steps.map.action')}</span>
                ) : null}
                {key === 'zones' && state === 'current' ? (
                  <span className="event-vip-setup-flow__hint">{t('eventVipSetup.steps.zones.action')}</span>
                ) : null}
                {key === 'tables' && zoneCount > 0 && tableCount === 0 ? (
                  <Link to={`/events/${eventId}/vip-tables`} className="event-vip-setup-flow__link">
                    {t('eventVipSetup.steps.tables.action')}
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
