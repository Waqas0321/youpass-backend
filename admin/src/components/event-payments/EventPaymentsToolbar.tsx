import { useI18n } from '../../i18n/useI18n';
import { IconChevronDown, IconSearch, IconSliders } from '../ui/Icons';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
};

export function EventPaymentsToolbar({ search, onSearchChange, onOpenFilters }: Props) {
  const { t } = useI18n();

  return (
    <div className="event-payments-toolbar">
      <label className="event-payments-search">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('eventPayments.searchPlaceholder')}
        />
        <IconSearch className="event-payments-search__icon" />
      </label>

      <button type="button" className="event-payments-filters-btn" onClick={onOpenFilters}>
        <IconSliders />
        {t('eventPayments.filters')}
        <IconChevronDown />
      </button>
    </div>
  );
}
