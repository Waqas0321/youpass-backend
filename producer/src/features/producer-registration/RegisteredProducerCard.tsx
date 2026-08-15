import type { RegisteredProducer } from './registeredProducersDemo';
import { IconMapPin } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';

type Props = {
  producer: RegisteredProducer;
  onViewInfo: (producerId: string) => void;
};

export function RegisteredProducerCard({ producer, onViewInfo }: Props) {
  const { t } = useI18n();
  const isActive = producer.status === 'active';

  return (
    <article className="prod-reg-producer-card">
      <div
        className="prod-reg-producer-card__logo"
        style={{ background: `linear-gradient(145deg, ${producer.logoColor} 0%, rgba(0,0,0,0.35) 140%)` }}
        aria-hidden="true"
      >
        <span>{producer.logoLabel}</span>
      </div>

      <div className="prod-reg-producer-card__body">
        <h2>{producer.name}</h2>
        <p className="prod-reg-producer-card__location">
          <IconMapPin className="prod-reg-producer-card__location-icon" aria-hidden="true" />
          <span>
            {producer.city}, {producer.country}
          </span>
        </p>
        <p
          className={
            isActive
              ? 'prod-reg-producer-card__status prod-reg-producer-card__status--active'
              : 'prod-reg-producer-card__status prod-reg-producer-card__status--inactive'
          }
        >
          <span className="prod-reg-producer-card__status-dot" aria-hidden="true" />
          {isActive ? t('registeredProducers.statusActive') : t('registeredProducers.statusInactive')}
        </p>
        <div className="prod-reg-producer-card__footer">
          <button
            type="button"
            className="prod-reg-producer-card__cta"
            onClick={() => onViewInfo(producer.id)}
          >
            {t('registeredProducers.viewInfo')}
          </button>
        </div>
      </div>
    </article>
  );
}
