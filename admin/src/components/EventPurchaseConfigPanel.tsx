import { EventTicketOfferingsPanel } from './EventTicketOfferingsPanel';
import { EventVenueLayoutPanel } from './EventVenueLayoutPanel';

type Props = {
  eventId: string;
  eventTitle: string;
  venueName?: string;
};

const SECTIONS = [
  { id: 'purchase-overview', label: 'Overview' },
  { id: 'purchase-general', label: '1 · General tickets' },
  { id: 'purchase-vip-general', label: '2 · VIP General' },
  { id: 'purchase-vip-zones', label: '3 · VIP zones & tables' },
] as const;

export function EventPurchaseConfigPanel({ eventId, eventTitle, venueName }: Props) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="purchase-config">
      <nav className="purchase-config__nav" aria-label="Purchase configuration sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="purchase-config__nav-link"
            onClick={() => scrollTo(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <section id="purchase-overview" className="purchase-config__overview">
        <h3>How this maps to the app</h3>
        <p className="muted">
          Everything below controls what guests see on <strong>Buy tickets</strong> for “
          {eventTitle}”.
        </p>
        <div className="purchase-config__map">
          <article className="purchase-config__map-card">
            <p className="purchase-config__map-step">App screen 1</p>
            <strong>General tickets</strong>
            <p className="muted">
              Early Bird, Pre-sale 2nd/3rd wave, General. Quantity stepper — no app-side cap;
              stock is set per wave in section{' '}
              <button type="button" className="text-link" onClick={() => scrollTo('purchase-general')}>
                1 · General tickets
              </button>
              .
            </p>
          </article>
          <article className="purchase-config__map-card">
            <p className="purchase-config__map-step">App screen 1</p>
            <strong>VIP General</strong>
            <p className="muted">
              VIP admission without a table. Configure in section{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => scrollTo('purchase-vip-general')}
              >
                2 · VIP General
              </button>
              .
            </p>
          </article>
          <article className="purchase-config__map-card">
            <p className="purchase-config__map-step">App screen 2 → 3</p>
            <strong>VIP zones → tables</strong>
            <p className="muted">
              Floor plan (VIP 1, VIP DJ…) then table map (M1–M8). Configure zones and tables in
              section{' '}
              <button type="button" className="text-link" onClick={() => scrollTo('purchase-vip-zones')}>
                3 · VIP zones & tables
              </button>
              .
            </p>
          </article>
        </div>
        <ul className="purchase-config__stock-notes muted">
          <li>
            <strong>General / VIP General stock:</strong> set <em>Stock total</em> and{' '}
            <em>Stock remaining</em> per wave. Guests only see Sold out — not numbers.
          </li>
          <li>
            <strong>VIP table stock:</strong> one table = one unit. Set each table status to{' '}
            <em>available</em> or <em>sold</em>. VIP 1 / VIP 2 = 10 seats; VIP DJ = 15 seats
            (set <em>Capacity per table</em> on the zone).
          </li>
          <li>
            <strong>Table lock:</strong> guests get a 10-minute hold when they start checkout on a
            table (configurable under layout settings).
          </li>
          <li>
            <strong>Zones are not tickets.</strong> Zones group tables on the floor plan — guests pick
            a zone, then a table inside it.
          </li>
        </ul>
      </section>

      <div id="purchase-general" className="purchase-config__section">
        <EventTicketOfferingsPanel
          eventId={eventId}
          eventTitle={eventTitle}
          section="general"
          title="1 · General tickets"
          description="Waves shown under GENERAL TICKETS in the app (Early Bird, Pre-sale 2nd/3rd wave, General)."
        />
      </div>

      <div id="purchase-vip-general" className="purchase-config__section">
        <EventTicketOfferingsPanel
          eventId={eventId}
          eventTitle={eventTitle}
          section="vip"
          title="2 · VIP General"
          description="VIP admission without reserving a table — shown under VIP ADMISSION in the app."
        />
      </div>

      <div id="purchase-vip-zones" className="purchase-config__section">
        <EventVenueLayoutPanel
          eventId={eventId}
          eventTitle={eventTitle}
          venueName={venueName}
        />
      </div>
    </div>
  );
}
