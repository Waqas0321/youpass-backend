import type { EventDrinkProduct, EventDrinkProductInput } from '../../api/client';
import {
  formatDrinkPriceFormValue,
  parseDrinkPriceFormValue,
} from '../../utils/drinkPriceInput';

export const DRINK_PRODUCT_DESCRIPTION_MAX = 300;
export const DRINK_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type DrinkProductFormState = {
  name: string;
  price: string;
  costPrice: string;
  stock: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  isRecommended: boolean;
};

export const EMPTY_DRINK_PRODUCT_FORM: DrinkProductFormState = {
  name: '',
  price: '',
  costPrice: '',
  stock: '',
  categoryId: '',
  description: '',
  imageUrl: '',
  isRecommended: true,
};

export function drinkProductToFormState(
  product: EventDrinkProduct,
  currency: string,
): DrinkProductFormState {
  return {
    name: product.name,
    price: formatDrinkPriceFormValue(product.price ?? product.price_clp, currency),
    costPrice:
      product.cost_clp != null ? formatDrinkPriceFormValue(product.cost_clp, currency) : '',
    stock: product.stock_total != null ? String(product.stock_total) : '',
    categoryId: product.category_id ?? '',
    description: product.description ?? '',
    imageUrl: product.image_url ?? '',
    isRecommended: product.is_recommended,
  };
}

export function drinkProductFormToInput(
  form: DrinkProductFormState,
  currency: string,
  existing?: EventDrinkProduct | null,
): EventDrinkProductInput {
  const stockTotal = Number(form.stock);
  const price = parseDrinkPriceFormValue(form.price, currency);
  const costRaw = form.costPrice.trim();

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    category_id: form.categoryId || null,
    price_clp: price,
    cost_clp: costRaw === '' ? null : parseDrinkPriceFormValue(costRaw, currency),
    image_url: form.imageUrl.trim() || null,
    stock_total: Number.isFinite(stockTotal) ? stockTotal : null,
    stock_remaining: Number.isFinite(stockTotal) ? stockTotal : null,
    is_recommended: form.isRecommended,
    volume_ml: existing?.volume_ml ?? null,
    status: existing?.status ?? 'available',
  };
}
