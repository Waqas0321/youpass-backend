import { Link } from 'react-router-dom';
import { EventDrinkProduct } from '../../api/client';
import { formatDrinkPriceClp } from '../../utils/drinkPrice';

type Props = {
  product: EventDrinkProduct;
  eventId: string;
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
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=160&q=80';

export function DrinkMenuProductPreviewRow({ product, eventId }: Props) {
  const stockLabel =
    product.stock_remaining != null ? product.stock_remaining : 'Unlimited';

  return (
    <article className="drink-menu-product-row">
      <img
        src={product.image_url || PLACEHOLDER_IMAGE}
        alt=""
        className="drink-menu-product-row__image"
      />
      <div className="drink-menu-product-row__main">
        <div className="drink-menu-product-row__title">
          <strong>{product.name}</strong>
          <span className={statusClass(product.status)}>{statusLabel(product.status)}</span>
        </div>
        {product.description ? (
          <p className="drink-menu-product-row__description">{product.description}</p>
        ) : null}
      </div>
      <div className="drink-menu-product-row__meta">
        <span className="drink-menu-product-row__price">{formatPrice(product.price_clp)}</span>
        <span className="muted">Stock {stockLabel}</span>
      </div>
      <Link className="ghost-btn ghost-btn--sm" to={`/events/${eventId}/drinks`}>
        Edit
      </Link>
    </article>
  );
}
