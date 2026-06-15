export type BusinessHoursSlot = { from: string; to: string } | null;

export type BusinessHoursConfig = {
  timezone: string;
  weekdays: BusinessHoursSlot;
  saturday: BusinessHoursSlot;
  sunday: BusinessHoursSlot;
};

function parseMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

function getZonedWeekdayAndMinutes(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date);

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const [hours, minutes] = time.split(':').map((part) => Number(part));

  return {
    weekday,
    minutes: hours * 60 + minutes,
  };
}

function isWithinSlot(minutes: number, slot: BusinessHoursSlot) {
  if (!slot) {
    return false;
  }

  const from = parseMinutes(slot.from);
  const to = parseMinutes(slot.to);
  return minutes >= from && minutes < to;
}

export function isWithinBusinessHours(
  hours: BusinessHoursConfig,
  date = new Date(),
): boolean {
  const { weekday, minutes } = getZonedWeekdayAndMinutes(date, hours.timezone);

  if (weekday === 'Sun') {
    return isWithinSlot(minutes, hours.sunday);
  }

  if (weekday === 'Sat') {
    return isWithinSlot(minutes, hours.saturday);
  }

  return isWithinSlot(minutes, hours.weekdays);
}
