import { parseIsoDate } from '../calendar/formatCalendarDates';
import type {
  ConsumptionSort,
  JoinDateSort,
  LoyaltyFilter,
  ProducerUser,
} from './types';

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterUsersByQuery(users: ProducerUser[], query: string) {
  const term = normalize(query);
  if (!term) {
    return users;
  }

  return users.filter((user) => {
    const haystack = [user.name, user.phone].map(normalize).join(' ');
    return haystack.includes(term);
  });
}

export function filterUsersByLoyalty(users: ProducerUser[], loyalty: LoyaltyFilter) {
  if (loyalty === 'all') {
    return users;
  }

  return users.filter((user) => user.loyaltyTier === loyalty);
}

export function sortUsers(
  users: ProducerUser[],
  joinDateSort: JoinDateSort,
  consumptionSort: ConsumptionSort,
) {
  const sorted = [...users];

  sorted.sort((a, b) => {
    const joinDiff = parseIsoDate(a.joinedAt).getTime() - parseIsoDate(b.joinedAt).getTime();
    if (joinDiff !== 0) {
      return joinDateSort === 'oldest' ? joinDiff : -joinDiff;
    }

    const consumptionDiff = a.avgTicketClp - b.avgTicketClp;
    return consumptionSort === 'highToLow' ? -consumptionDiff : consumptionDiff;
  });

  return sorted;
}
