import { IconTicket } from '../ui/Icons';

type Props = {
  name: string;
  nameFallback: string;
  priceLabel: string;
  color: string;
  imageUrl: string;
  validFromLabel: string;
  validToLabel: string;
};

export function EventTicketPreviewCard({
  name,
  nameFallback,
  priceLabel,
  color,
  imageUrl,
  validFromLabel,
  validToLabel,
}: Props) {
  return (
    <article className="event-ticket-modal__preview-card" style={{ borderColor: color }}>
      <span
        className="event-ticket-modal__preview-icon"
        style={{ color, background: `${color}22` }}
      >
        {imageUrl ? <img src={imageUrl} alt="" /> : <IconTicket />}
      </span>
      <div>
        <strong>{name || nameFallback}</strong>
        <p>${priceLabel} CLP</p>
        <small>{validFromLabel}</small>
        <small>{validToLabel}</small>
      </div>
    </article>
  );
}
