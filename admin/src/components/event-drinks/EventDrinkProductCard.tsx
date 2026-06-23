import { EventDrinkProduct } from '../../api/client';
import { formatDrinkPriceClp } from '../../utils/drinkPrice';
import { IconBan, IconCopy, IconEdit, IconEye, IconTrash } from '../ui/Icons';

type Props = {
  product: EventDrinkProduct;
  preview?: boolean;
  onEdit: () => void;
  onHide: () => void;
  onSoldOut: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function formatPrice(clp: number) {
  return formatDrinkPriceClp(clp);
}

function statusClass(status: EventDrinkProduct['status']) {
  if (status === 'available') return 'drink-status drink-status--available';
  if (status === 'sold_out') return 'drink-status drink-status--sold-out';
  return 'drink-status drink-status--hidden';
}

function statusLabel(status: EventDrinkProduct['status']) {
  if (status === 'available') return 'AVAILABLE';
  if (status === 'sold_out') return 'SOLD OUT';
  return 'HIDDEN';
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=320&q=80';

export function EventDrinkProductCard({
  product,
  preview = false,
  onEdit,
  onHide,
  onSoldOut,
  onDuplicate,
  onDelete,
}: Props) {
  const stockLabel =
    product.stock_remaining != null ? `${product.stock_remaining}` : 'Unlimited';

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
            <span className={statusClass(product.status)}>{statusLabel(product.status)}</span>
          </div>
          {product.description ? <p className="drink-product-card__description">{product.description}</p> : null}
          <p className="drink-product-card__price">{formatPrice(product.price_clp)}</p>
          <p className="drink-product-card__stock">
            Stock available <strong>{stockLabel}</strong>
          </p>
        </div>
      </div>

      {preview ? null : (
      <div className="drink-product-card__actions">
        <button type="button" className="drink-product-card__action" onClick={onEdit}>
          <IconEdit />
          <span>Edit</span>
        </button>
        <button type="button" className="drink-product-card__action" onClick={onHide}>
          <IconEye />
          <span>Hide</span>
        </button>
        <button type="button" className="drink-product-card__action" onClick={onSoldOut}>
          <IconBan />
          <span>Mark sold out</span>
        </button>
        <button type="button" className="drink-product-card__action" onClick={onDuplicate}>
          <IconCopy />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          className="drink-product-card__action drink-product-card__action--danger"
          onClick={onDelete}
        >
          <IconTrash />
          <span>Delete</span>
        </button>
      </div>
      )}
    </article>
  );
}
