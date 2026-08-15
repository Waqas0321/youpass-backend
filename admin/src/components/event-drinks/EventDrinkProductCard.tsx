import { EventDrinkProduct } from '../../api/client';
import { useI18n } from '../../i18n/useI18n';
import { formatDrinkPrice } from '../../utils/drinkPrice';
import { IconBan, IconCheckCircle, IconCopy, IconEdit, IconEyeOff, IconTrash } from '../ui/Icons';

type Props = {
  product: EventDrinkProduct;
  currency: string;
  preview?: boolean;
  onEdit: () => void;
  onHide: () => void;
  onSoldOut: () => void;
  onAvailable: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=320&q=80';

function statusClass(status: EventDrinkProduct['status']) {
  if (status === 'available') return 'drink-status drink-status--available';
  if (status === 'sold_out') return 'drink-status drink-status--sold-out';
  return 'drink-status drink-status--hidden';
}

export function EventDrinkProductCard({
  product,
  currency,
  preview = false,
  onEdit,
  onHide,
  onSoldOut,
  onAvailable,
  onDuplicate,
  onDelete,
}: Props) {
  const { t, numberLocale } = useI18n();
  const isAvailable = product.status === 'available';

  const stockLabel =
    product.stock_remaining != null
      ? new Intl.NumberFormat(numberLocale).format(product.stock_remaining)
      : t('drinkMenu.unlimitedStock');

  const priceMinor = product.price_clp;

  return (
    <article className="drink-product-card">
      <div className="drink-product-card__body">
        <img
          src={product.image_url || PLACEHOLDER_IMAGE}
          alt=""
          className="drink-product-card__image"
        />
        <div className="drink-product-card__info">
          <div className="drink-product-card__title-row">
            <h3>{product.name}</h3>
            <span className={statusClass(product.status)}>
              {t(`drinkMenu.status.${product.status}`)}
            </span>
          </div>
          {product.description ? (
            <p className="drink-product-card__description">{product.description}</p>
          ) : null}
          {product.category_name ? (
            <p className="drink-product-card__category muted">{product.category_name}</p>
          ) : null}
          <p className="drink-product-card__price">
            {formatDrinkPrice(priceMinor, currency, numberLocale)}
          </p>
          <p className="drink-product-card__stock">
            {t('drinkMenu.stockAvailable')} <strong>{stockLabel}</strong>
          </p>
        </div>
      </div>

      {preview ? null : (
        <div className="drink-product-card__actions">
          <button type="button" className="drink-product-card__action" onClick={onEdit}>
            <IconEdit />
            <span>{t('drinkMenu.actions.edit')}</span>
          </button>
          {isAvailable ? (
            <>
              <button type="button" className="drink-product-card__action" onClick={onHide}>
                <IconEyeOff />
                <span>{t('drinkMenu.actions.hide')}</span>
              </button>
              <button type="button" className="drink-product-card__action" onClick={onSoldOut}>
                <IconBan />
                <span>{t('drinkMenu.actions.soldOut')}</span>
              </button>
            </>
          ) : (
            <button type="button" className="drink-product-card__action" onClick={onAvailable}>
              <IconCheckCircle />
              <span>{t('drinkMenu.actions.markAvailable')}</span>
            </button>
          )}
          <button type="button" className="drink-product-card__action" onClick={onDuplicate}>
            <IconCopy />
            <span>{t('drinkMenu.actions.duplicate')}</span>
          </button>
          <button
            type="button"
            className="drink-product-card__action drink-product-card__action--danger"
            onClick={onDelete}
          >
            <IconTrash />
            <span>{t('drinkMenu.actions.delete')}</span>
          </button>
        </div>
      )}
    </article>
  );
}
