import { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '../ui/Icons';
import { useI18n } from '../../i18n/useI18n';
import { EventDrinkProductCard } from './EventDrinkProductCard';
import { DRINK_MENU_PAGE_SIZE } from '../../constants/drinkMenu';
import type { EventDrinkProduct } from '../../api/client';

type Props = {
  products: EventDrinkProduct[];
  currency: string;
  onEdit: (product: EventDrinkProduct) => void;
  onHide: (product: EventDrinkProduct) => void;
  onSoldOut: (product: EventDrinkProduct) => void;
  onAvailable: (product: EventDrinkProduct) => void;
  onDuplicate: (product: EventDrinkProduct) => void;
  onDelete: (product: EventDrinkProduct) => void;
  onAddProduct: () => void;
};

export function EventDrinkProductGrid({
  products,
  currency,
  onEdit,
  onHide,
  onSoldOut,
  onAvailable,
  onDuplicate,
  onDelete,
  onAddProduct,
}: Props) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(products.length / DRINK_MENU_PAGE_SIZE));
  const pageProducts = useMemo(() => {
    const start = (page - 1) * DRINK_MENU_PAGE_SIZE;
    return products.slice(start, start + DRINK_MENU_PAGE_SIZE);
  }, [page, products]);

  const from = products.length === 0 ? 0 : (page - 1) * DRINK_MENU_PAGE_SIZE + 1;
  const to = Math.min(page * DRINK_MENU_PAGE_SIZE, products.length);

  if (products.length === 0) {
    return (
      <div className="drink-menu-empty">
        <h3>{t('drinkMenu.emptyTitle')}</h3>
        <p className="muted">{t('drinkMenu.emptyBody')}</p>
        <button type="button" className="event-workspace__btn event-workspace__btn--primary" onClick={onAddProduct}>
          {t('drinkMenu.addProduct')}
        </button>
      </div>
    );
  }

  return (
    <div className="drink-menu-products">
      <div className="drink-product-grid">
        {pageProducts.map((product) => (
          <EventDrinkProductCard
            key={product.product_id}
            product={product}
            currency={currency}
            onEdit={() => onEdit(product)}
            onHide={() => onHide(product)}
            onSoldOut={() => onSoldOut(product)}
            onAvailable={() => onAvailable(product)}
            onDuplicate={() => onDuplicate(product)}
            onDelete={() => onDelete(product)}
          />
        ))}
      </div>

      <footer className="drink-menu-pagination">
        <p className="muted">
          {t('drinkMenu.pagination', {
            from: String(from),
            to: String(to),
            total: String(products.length),
          })}
        </p>
        <div className="drink-menu-pagination__controls">
          <button
            type="button"
            className="drink-menu-pagination__btn"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            aria-label={t('drinkMenu.previousPage')}
          >
            <IconChevronLeft />
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={
                pageNumber === page
                  ? 'drink-menu-pagination__btn drink-menu-pagination__btn--active'
                  : 'drink-menu-pagination__btn'
              }
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            className="drink-menu-pagination__btn"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            aria-label={t('drinkMenu.nextPage')}
          >
            <IconChevronRight />
          </button>
        </div>
      </footer>
    </div>
  );
}
