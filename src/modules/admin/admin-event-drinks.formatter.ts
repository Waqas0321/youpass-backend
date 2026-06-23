import type {
  EventDrinkCategory,
  EventDrinkProduct,
  EventDrinkProductStatus,
} from '@prisma/client';

export type AdminEventDrinkCategoryDto = {
  category_id: string;
  event_id: string;
  slug: string;
  name: string;
  icon: string | null;
  display_order: number;
};

export type AdminEventDrinkProductDto = {
  product_id: string;
  event_id: string;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  volume_ml: number | null;
  price_clp: number;
  image_url: string | null;
  stock_total: number | null;
  stock_remaining: number | null;
  status: EventDrinkProductStatus;
  display_order: number;
  is_recommended: boolean;
};

export function formatAdminEventDrinkCategory(
  category: EventDrinkCategory,
): AdminEventDrinkCategoryDto {
  return {
    category_id: category.id,
    event_id: category.eventId,
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    display_order: category.displayOrder,
  };
}

type ProductWithCategory = EventDrinkProduct & {
  category?: EventDrinkCategory | null;
};

export function formatAdminEventDrinkProduct(
  product: ProductWithCategory,
): AdminEventDrinkProductDto {
  return {
    product_id: product.id,
    event_id: product.eventId,
    category_id: product.categoryId,
    category_slug: product.category?.slug ?? null,
    category_name: product.category?.name ?? null,
    name: product.name,
    description: product.description,
    volume_ml: product.volumeMl,
    price_clp: product.priceClp,
    image_url: product.imageUrl,
    stock_total: product.stockTotal,
    stock_remaining: product.stockRemaining,
    status: product.status,
    display_order: product.displayOrder,
    is_recommended: product.isRecommended,
  };
}
