import { useMemo, useState } from 'react';
import { ProducerPageActions } from '../../components/layout/ProducerPageActions';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useI18n } from '../../i18n/useI18n';
import { formatDateRangeLabel } from '../calendar/formatCalendarDates';
import { UsersFilterBar } from './UsersFilterBar';
import { UsersTable } from './UsersTable';
import type { ConsumptionSort, JoinDateSort, LoyaltyFilter } from './types';
import { producerUsersDemo, USERS_PAGE_DATE_RANGE } from './usersDemo';
import {
  filterUsersByLoyalty,
  filterUsersByQuery,
  sortUsers,
} from './usersUtils';

export function UsersPageContent() {
  const { locale, t, dateLocale } = useI18n();
  const [query, setQuery] = useState('');
  const [loyaltyFilter, setLoyaltyFilter] = useState<LoyaltyFilter>('all');
  const [joinDateSort, setJoinDateSort] = useState<JoinDateSort>('oldest');
  const [consumptionSort, setConsumptionSort] = useState<ConsumptionSort>('highToLow');

  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(USERS_PAGE_DATE_RANGE.start, USERS_PAGE_DATE_RANGE.end, dateLocale),
    [dateLocale],
  );

  const users = useMemo(() => {
    const filtered = filterUsersByLoyalty(
      filterUsersByQuery(producerUsersDemo, query),
      loyaltyFilter,
    );
    return sortUsers(filtered, joinDateSort, consumptionSort);
  }, [consumptionSort, joinDateSort, loyaltyFilter, query]);

  useDocumentTitle('users');

  return (
    <section className="prod-users-page" key={locale}>
      <header className="prod-users-page__header">
        <div className="prod-users-page__intro">
          <h1>{t('users.title')}</h1>
          <p>{t('users.subtitle')}</p>
        </div>
        <ProducerPageActions dateRangeLabel={dateRangeLabel} />
      </header>

      <UsersFilterBar
        query={query}
        onQueryChange={setQuery}
        loyaltyFilter={loyaltyFilter}
        onLoyaltyFilterChange={setLoyaltyFilter}
        joinDateSort={joinDateSort}
        onJoinDateSortChange={setJoinDateSort}
        consumptionSort={consumptionSort}
        onConsumptionSortChange={setConsumptionSort}
      />

      {users.length === 0 ? (
        <p className="prod-users-page__empty">{t('users.noResults')}</p>
      ) : (
        <UsersTable users={users} />
      )}
    </section>
  );
}
