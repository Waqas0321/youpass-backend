import { CountryOption, PhysicalVenue } from '../api/client';

export type EventVenueFormSlice = {
  venue_id?: string;
  venue_name: string;
  city: string;
  country_code: string;
};

type Props = {
  value: EventVenueFormSlice;
  venues: PhysicalVenue[];
  countries: CountryOption[];
  linkedVenueHint?: PhysicalVenue | null;
  onChange: (patch: Partial<EventVenueFormSlice>) => void;
};

export function EventVenueFields({
  value,
  venues,
  countries,
  linkedVenueHint,
  onChange,
}: Props) {
  const linkedVenue = value.venue_id
    ? venues.find((venue) => venue.id === value.venue_id) ?? linkedVenueHint ?? null
    : null;

  function selectCatalogVenue(venueId: string) {
    if (!venueId) {
      onChange({ venue_id: undefined });
      return;
    }
    const venue = venues.find((item) => item.id === venueId);
    if (!venue) return;
    onChange({
      venue_id: venue.id,
      venue_name: venue.name,
      city: venue.city,
      country_code: venue.country,
    });
  }

  return (
    <>
      <label className="field form-grid__full">
        <span className="field__label">Physical venue (catalog)</span>
        <select
          value={value.venue_id ?? ''}
          onChange={(e) => selectCatalogVenue(e.target.value)}
        >
          <option value="">Custom venue (manual entry)</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} — {venue.city}, {venue.country}
            </option>
          ))}
        </select>
        <span className="muted">
          Reusable venues from the catalog. Pick one to auto-fill location, or enter details manually.
        </span>
      </label>

      {linkedVenue ? (
        <div className="field form-grid__full">
          <span className="field__label">Linked venue</span>
          <p className="muted">
            {linkedVenue.address} · {linkedVenue.city}, {linkedVenue.country} ·{' '}
            {linkedVenue.dimensions.width_meters}m × {linkedVenue.dimensions.height_meters}m
          </p>
        </div>
      ) : null}

      <label className="field">
        <span className="field__label">{value.venue_id ? 'Display name' : 'Venue'}</span>
        <input
          value={value.venue_name}
          onChange={(e) => onChange({ venue_name: e.target.value })}
          placeholder="Teatro Coliseo"
          required
        />
      </label>

      <label className="field">
        <span className="field__label">City</span>
        <input
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="Santiago"
          required
          readOnly={Boolean(value.venue_id)}
        />
      </label>

      <label className="field">
        <span className="field__label">Country</span>
        <select
          value={value.country_code}
          onChange={(e) => onChange({ country_code: e.target.value })}
          required
          disabled={Boolean(value.venue_id)}
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag_emoji ? `${country.flag_emoji} ` : ''}
              {country.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
