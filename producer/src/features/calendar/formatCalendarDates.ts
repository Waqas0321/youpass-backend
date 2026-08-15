export function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShortMonth(iso: string, locale: string) {
  const formatted = new Intl.DateTimeFormat(locale, { month: 'short' }).format(parseIsoDate(iso));
  return capitalize(formatted.replace('.', '').trim());
}

export function formatEventShortDate(iso: string, locale: string) {
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${formatShortMonth(iso, locale)}`;
}

export function formatEventPickerDate(iso: string, locale: string) {
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${formatShortMonth(iso, locale)} ${date.getFullYear()}`;
}

export function formatEventCompactDate(iso: string, locale: string) {
  const date = parseIsoDate(iso);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
    .format(date)
    .replace(/\./g, '')
    .trim()
    .toUpperCase();

  return `${date.getDate()} ${month}`;
}

export function formatDateRangeLabel(startIso: string, endIso: string, locale: string) {
  const end = parseIsoDate(endIso);
  const startText = formatEventShortDate(startIso, locale);
  const endText = `${end.getDate()} ${formatShortMonth(endIso, locale)} ${end.getFullYear()}`;

  return `${startText} – ${endText}`;
}

export function formatSparklineLabel(iso: string, locale: string) {
  const date = parseIsoDate(iso);
  const day = date.getDate();
  const month = formatShortMonth(iso, locale);
  return `${day} ${month}`;
}

export function formatUserJoinedDate(iso: string, locale: string) {
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${formatShortMonth(iso, locale)} ${date.getFullYear()}`;
}

export function formatEventLongDate(iso: string, locale: string) {
  const date = parseIsoDate(iso);

  if (locale.startsWith('es')) {
    const day = date.getDate();
    const month = capitalize(new Intl.DateTimeFormat(locale, { month: 'long' }).format(date));
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  }

  const formatted = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return capitalize(formatted);
}

export function formatEventOptionLabel(title: string, iso: string, locale: string) {
  const date = parseIsoDate(iso);
  return `${title} — ${date.getDate()} ${formatShortMonth(iso, locale)} ${date.getFullYear()}`;
}
