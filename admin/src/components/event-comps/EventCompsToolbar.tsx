import { useI18n } from '../../i18n/useI18n';
import { IconChevronDown, IconSearch, IconSliders } from '../ui/Icons';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
};

export function EventCompsToolbar({ search, onSearchChange, onOpenFilters }: Props) {
  const { t } = useI18n();

  return (
    <div className="event-comps-toolbar">
      <label className="event-comps-search">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('eventComps.searchPlaceholder')}
        />
        <IconSearch className="event-comps-search__icon" />
      </label>

      <button type="button" className="event-comps-filters-btn" onClick={onOpenFilters}>
        <IconSliders />
        {t('eventComps.filters')}
        <IconChevronDown />
      </button>
    </div>
  );
}
