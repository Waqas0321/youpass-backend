type DatePreset = 'today' | 'this_week' | 'this_weekend' | 'this_month';

function startOfDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setUTCHours(23, 59, 59, 999);
  return next;
}

export function resolveDateRange(input: {
  date_preset?: DatePreset;
  date_from?: string;
  date_to?: string;
  timezone?: string;
}): { gte?: Date; lte?: Date } | undefined {
  const timezone = input.timezone ?? 'UTC';
  const now = new Date();

  if (input.date_from || input.date_to) {
    return {
      ...(input.date_from ? { gte: new Date(input.date_from) } : {}),
      ...(input.date_to ? { lte: new Date(input.date_to) } : {}),
    };
  }

  if (!input.date_preset) {
    return undefined;
  }

  const todayStart = startOfDay(now, timezone);

  switch (input.date_preset) {
    case 'today':
      return { gte: todayStart, lte: endOfDay(todayStart) };
    case 'this_week': {
      const day = todayStart.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const weekStart = addDays(todayStart, mondayOffset);
      const weekEnd = endOfDay(addDays(weekStart, 6));
      return { gte: weekStart, lte: weekEnd };
    }
    case 'this_weekend': {
      const day = todayStart.getUTCDay();
      const saturdayOffset = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
      const weekendStart = addDays(todayStart, saturdayOffset);
      const weekendEnd = endOfDay(addDays(weekendStart, 1));
      return { gte: weekendStart, lte: weekendEnd };
    }
    case 'this_month': {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(now);
      const year = Number(parts.find((p) => p.type === 'year')?.value);
      const month = Number(parts.find((p) => p.type === 'month')?.value);
      const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const monthEnd = endOfDay(new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)));
      return { gte: monthStart, lte: monthEnd };
    }
    default:
      return undefined;
  }
}
