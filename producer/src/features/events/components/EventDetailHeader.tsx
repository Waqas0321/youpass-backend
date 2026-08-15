import type { ProducerEvent } from '../types';
import { eventCategoryLabel } from '../../../i18n/localize';
import { useI18n } from '../../../i18n/useI18n';

type Props = {
  event: ProducerEvent;
};

export function EventDetailHeader({ event }: Props) {
  const { t } = useI18n();

  return (
    <header className="prod-event-detail__header">
      <div className="prod-event-detail__header-main">
        <img
          className="prod-event-detail__poster"
          src={event.posterUrl}
          alt=""
          loading="lazy"
        />
        <div className="prod-event-detail__header-copy">
          <h1>{event.displayTitle}</h1>
          <span className={`prod-event-detail__badge prod-event-detail__badge--${event.categoryTone}`}>
            {eventCategoryLabel(t, event.categoryTone)}
          </span>
        </div>
      </div>
    </header>
  );
}
