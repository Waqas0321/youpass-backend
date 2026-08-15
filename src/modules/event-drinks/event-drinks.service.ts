import { getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { assertUserHasTicketForEvent } from './event-drink-access.js';
import { drinkPriceDecimals, drinkPriceToDisplay } from './drink-price.utils.js';
import { prisma } from '../../config/database.js';

function isProductAvailable(
  status: string,
  stockRemaining: number | null,
): boolean {
  if (status === 'hidden') {
    return false;
  }
  if (status === 'sold_out') {
    return false;
  }
  if (stockRemaining != null && stockRemaining <= 0) {
    return false;
  }
  return true;
}

export const eventDrinksService = {
  async getMenuForUser(userId: string, eventId: string) {
    await assertUserHasTicketForEvent(userId, eventId);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { countryCode: true },
    });
    const currencyMeta = getEventCurrencyMeta(event?.countryCode ?? 'CL');
    const currency = currencyMeta.currency;

    const [categories, products] = await Promise.all([
      prisma.eventDrinkCategory.findMany({
        where: { eventId },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.eventDrinkProduct.findMany({
        where: {
          eventId,
          status: { not: 'hidden' },
        },
        include: { category: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      event_id: eventId,
      currency,
      currency_decimals: drinkPriceDecimals(currency),
      categories: categories.map((category) => ({
        category_id: category.id,
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        display_order: category.displayOrder,
      })),
      products: products.map((product) => ({
        product_id: product.id,
        category_id: product.categoryId,
        category_slug: product.category?.slug ?? null,
        category_name: product.category?.name ?? null,
        name: product.name,
        description: product.description,
        volume_ml: product.volumeMl,
        price_clp: product.priceClp,
        price: drinkPriceToDisplay(product.priceClp, currency),
        currency,
        image_url: product.imageUrl,
        status: product.status === 'sold_out' ? 'sold_out' : 'available',
        is_available: isProductAvailable(product.status, product.stockRemaining),
        is_recommended: product.isRecommended,
        display_order: product.displayOrder,
      })),
    };
  },
};
