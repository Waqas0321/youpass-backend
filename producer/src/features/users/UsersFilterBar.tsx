import { useMemo } from 'react';
import { IconChevronDown, IconSearch } from '../../components/ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { ConsumptionSort, JoinDateSort, LoyaltyFilter } from './types';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  loyaltyFilter: LoyaltyFilter;
  onLoyaltyFilterChange: (value: LoyaltyFilter) => void;
  joinDateSort: JoinDateSort;
  onJoinDateSortChange: (value: JoinDateSort) => void;
  consumptionSort: ConsumptionSort;
  onConsumptionSortChange: (value: ConsumptionSort) => void;
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="prod-users-filter">
      <span className="prod-users-filter__label">{label}</span>
      <span className="prod-users-filter__control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <IconChevronDown className="prod-users-filter__chevron" aria-hidden="true" />
      </span>
    </label>
  );
}

export function UsersFilterBar({
  query,
  onQueryChange,
  loyaltyFilter,
  onLoyaltyFilterChange,
  joinDateSort,
  onJoinDateSortChange,
  consumptionSort,
  onConsumptionSortChange,
}: Props) {
  const { locale, t } = useI18n();

  const loyaltyOptions = useMemo(
    () => [
      { value: 'all', label: t('users.filters.allCategories') },
      { value: 'diamond', label: t('users.loyalty.diamond') },
      { value: 'platinum', label: t('users.loyalty.platinum') },
      { value: 'gold', label: t('users.loyalty.gold') },
      { value: 'silver', label: t('users.loyalty.silver') },
      { value: 'bronze', label: t('users.loyalty.bronze') },
    ],
    [locale, t],
  );

  const joinDateOptions = useMemo(
    () => [
      { value: 'oldest', label: t('users.filters.oldestFirst') },
      { value: 'newest', label: t('users.filters.newestFirst') },
    ],
    [locale, t],
  );

  const consumptionOptions = useMemo(
    () => [
      { value: 'highToLow', label: t('users.filters.highToLow') },
      { value: 'lowToHigh', label: t('users.filters.lowToHigh') },
    ],
    [locale, t],
  );

  return (
    <div className="prod-users-filters" key={locale}>
      <label className="prod-users-search">
        <span className="prod-users-filter__label" aria-hidden="true">
          {'\u00A0'}
        </span>
        <span className="prod-users-search__control">
          <IconSearch className="prod-users-search__icon" aria-hidden="true" />
          <span className="prod-users-search__label">{t('users.searchAriaLabel')}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('users.searchPlaceholder')}
            aria-label={t('users.searchAriaLabel')}
          />
        </span>
      </label>

      <FilterSelect
        label={t('users.filters.loyaltyCategory')}
        value={loyaltyFilter}
        onChange={(value) => onLoyaltyFilterChange(value as LoyaltyFilter)}
        options={loyaltyOptions}
      />

      <FilterSelect
        label={t('users.filters.joinDate')}
        value={joinDateSort}
        onChange={(value) => onJoinDateSortChange(value as JoinDateSort)}
        options={joinDateOptions}
      />

      <FilterSelect
        label={t('users.filters.avgConsumption')}
        value={consumptionSort}
        onChange={(value) => onConsumptionSortChange(value as ConsumptionSort)}
        options={consumptionOptions}
      />
    </div>
  );
}
