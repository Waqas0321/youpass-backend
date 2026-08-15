import { IconEdit, IconEyeOff, IconPause, IconPlayCircle, IconTicket, IconTrash } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { EventTicketRow, EventTicketStatus } from './eventTicketsData';

type Props = {
  tickets: EventTicketRow[];
  onEdit: (ticket: EventTicketRow) => void;
  onPause: (ticket: EventTicketRow) => void;
  onHide: (ticket: EventTicketRow) => void;
  onDelete: (ticket: EventTicketRow) => void;
};

function formatTicketPrice(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTicketDate(iso: string | null, locale: string, emptyLabel: string) {
  if (!iso) {
    return emptyLabel;
  }

  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} hrs`;
}

function StatusBadge({ status }: { status: EventTicketStatus }) {
  const { t } = useI18n();
  return (
    <span className={`event-tickets__status event-tickets__status--${status}`}>
      <span className="event-tickets__status-dot" aria-hidden />
      {t(`eventTickets.status.${status}`)}
    </span>
  );
}

export function EventTicketsTable({ tickets, onEdit, onPause, onHide, onDelete }: Props) {
  const { t, numberLocale, dateLocale } = useI18n();

  return (
    <div className="event-tickets__table-card">
      <div className="event-tickets__table-wrap">
        <table className="event-tickets__table">
          <thead>
            <tr>
              <th>{t('eventTickets.columns.name')}</th>
              <th>{t('eventTickets.columns.price')}</th>
              <th>{t('eventTickets.columns.stock')}</th>
              <th>{t('eventTickets.columns.sold')}</th>
              <th>{t('eventTickets.columns.status')}</th>
              <th>{t('eventTickets.columns.activation')}</th>
              <th>{t('eventTickets.columns.expiration')}</th>
              <th>{t('eventTickets.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="event-tickets__empty">
                  {t('eventTickets.emptyState')}
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const isPaused = ticket.backendStatus === 'paused';
                const isHidden = ticket.backendStatus === 'closed';
                const stockLabel =
                  ticket.stockTotal == null
                    ? t('eventTickets.unlimitedStock')
                    : t('eventTickets.stockOf', {
                        total: new Intl.NumberFormat(numberLocale).format(ticket.stockTotal),
                      });

                return (
                  <tr key={ticket.id}>
                    <td>
                      <div className="event-tickets__name-cell">
                        <span
                          className="event-tickets__accent"
                          style={{ background: ticket.color }}
                          aria-hidden
                        />
                        <span
                          className="event-tickets__icon"
                          style={{
                            color: ticket.color,
                            background: `${ticket.color}22`,
                            borderColor: `${ticket.color}55`,
                          }}
                        >
                          <IconTicket />
                        </span>
                        <span className="event-tickets__name-copy">
                          <strong>{ticket.name}</strong>
                          <small>{t(ticket.subtitle)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="event-tickets__price">
                        <strong>{formatTicketPrice(ticket.price, ticket.currency, numberLocale)}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="event-tickets__stock">
                        <strong>
                          {ticket.stockRemaining != null
                            ? new Intl.NumberFormat(numberLocale).format(ticket.stockRemaining)
                            : '∞'}
                        </strong>
                        <span>{stockLabel}</span>
                      </span>
                    </td>
                    <td>
                      <strong>{new Intl.NumberFormat(numberLocale).format(ticket.sold)}</strong>
                    </td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>{formatTicketDate(ticket.saleStart, dateLocale, t('eventTickets.noDate'))}</td>
                    <td>{formatTicketDate(ticket.saleEnd, dateLocale, t('eventTickets.noDate'))}</td>
                    <td>
                      <div className="event-tickets__actions">
                        <button type="button" className="event-tickets__action" onClick={() => onEdit(ticket)}>
                          <IconEdit />
                          <span>{t('eventTickets.actions.edit')}</span>
                        </button>
                        <button
                          type="button"
                          className="event-tickets__action"
                          onClick={() => onHide(ticket)}
                        >
                          <IconEyeOff />
                          <span>
                            {isHidden ? t('eventTickets.actions.show') : t('eventTickets.actions.hide')}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="event-tickets__action"
                          onClick={() => onPause(ticket)}
                        >
                          {isPaused ? <IconPlayCircle /> : <IconPause />}
                          <span>
                            {isPaused ? t('eventTickets.actions.resume') : t('eventTickets.actions.pause')}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="event-tickets__action event-tickets__action--danger"
                          onClick={() => onDelete(ticket)}
                        >
                          <IconTrash />
                          <span>{t('eventTickets.actions.delete')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className="event-tickets__footer">
        <p>
          {t('eventTickets.pagination.showing', {
            from: String(tickets.length ? 1 : 0),
            to: String(tickets.length),
            total: String(tickets.length),
          })}
        </p>
        <div className="event-tickets__pager" aria-hidden>
          <button type="button" disabled>
            ‹
          </button>
          <button type="button" className="is-active" disabled>
            1
          </button>
          <button type="button" disabled>
            ›
          </button>
        </div>
      </footer>
    </div>
  );
}
