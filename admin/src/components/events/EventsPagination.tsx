import { useI18n } from '../../i18n/useI18n';
import { IconChevronLeft, IconChevronRight } from '../ui/Icons';

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | 'ellipsis'> = [1];

  if (currentPage > 3) {
    items.push('ellipsis');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < totalPages - 2) {
    items.push('ellipsis');
  }

  items.push(totalPages);
  return items;
}

type EventsPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalItems: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function EventsPagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  totalItems,
  from,
  to,
  onPageChange,
  onPageSizeChange,
}: EventsPaginationProps) {
  const { t } = useI18n();
  const pages = buildPaginationItems(currentPage, totalPages);

  return (
    <footer className="events-page__footer">
      <p>
        {t('eventsPage.pagination', {
          from: String(from),
          to: String(to),
          total: String(totalItems),
        })}
      </p>

      <div className="events-page__pagination">
        <button
          type="button"
          className="events-page__pagination-btn"
          disabled={currentPage <= 1}
          aria-label={t('eventsPage.prevPage')}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <IconChevronLeft />
        </button>
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="events-page__pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`events-page__pagination-btn ${
                page === currentPage ? 'events-page__pagination-btn--active' : ''
              }`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ),
        )}
        <button
          type="button"
          className="events-page__pagination-btn"
          disabled={currentPage >= totalPages}
          aria-label={t('eventsPage.nextPage')}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="events-page__page-size">
        <span>{t('eventsPage.eventsPerPage')}</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </footer>
  );
}
