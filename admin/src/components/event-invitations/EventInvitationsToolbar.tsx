import { useI18n } from '../../i18n/useI18n';
import { IconChevronDown, IconSearch, IconSliders } from '../ui/Icons';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function EventInvitationsToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  onClearFilters,
  hasActiveFilters,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="event-invitations-toolbar">
      <label className="event-invitations-search">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('eventInvitations.searchPlaceholder')}
        />
        <IconSearch className="event-invitations-search__icon" />
      </label>

      <button type="button" className="event-invitations-filters-btn" onClick={onOpenFilters}>
        <IconSliders />
        {t('eventInvitations.filters')}
        <IconChevronDown />
      </button>

      {hasActiveFilters ? (
        <button type="button" className="event-invitations-clear-filters" onClick={onClearFilters}>
          {t('eventInvitations.clearFilters')}
        </button>
      ) : null}
    </div>
  );
}
