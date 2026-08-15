export type CalendarDay = {
  date: Date;
  iso: string;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export type CalendarWeek = CalendarDay[];

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

export function addMonths(year: number, month: number, delta: number) {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildMonthWeeks(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 = 1,
): CalendarWeek[] {
  const today = new Date();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const startOffset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks: CalendarWeek[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= lastOfMonth || weeks.length < 6) {
    const week: CalendarDay[] = [];

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(cursor);
      week.push({
        date,
        iso: toIsoDate(date),
        inCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
    if (weeks.length >= 6 && cursor.getMonth() !== month) {
      break;
    }
  }

  return weeks;
}

export function formatMonthLabel(year: number, month: number, locale: string) {
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month, 1));
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
}

export function weekdayLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const monday = new Date(2026, 0, 5);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatter
      .format(date)
      .replace(/\./g, '')
      .slice(0, 3)
      .toUpperCase();
  });
}
