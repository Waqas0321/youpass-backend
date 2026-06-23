import type { EventDrinkProductStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  formatAdminEventDrinkCategory,
  formatAdminEventDrinkProduct,
} from './admin-event-drinks.formatter.js';
import type {
  AdminEventDrinkCategoryInput,
  AdminEventDrinkProductInput,
} from './admin-event-drinks.validators.js';

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  name: string;
  icon: string;
  displayOrder: number;
}> = [
  { slug: 'piscolas', name: 'Mixed drinks', icon: '🥃', displayOrder: 1 },
  { slug: 'gin', name: 'Gin', icon: '🍸', displayOrder: 2 },
  { slug: 'cervezas', name: 'Beers', icon: '🍺', displayOrder: 3 },
  { slug: 'energeticas', name: 'Energy drinks', icon: '⚡', displayOrder: 4 },
  { slug: 'espumantes', name: 'Sparkling', icon: '🍾', displayOrder: 5 },
  { slug: 'agua-bebidas', name: 'Water & soft drinks', icon: '💧', displayOrder: 6 },
];

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function assertEventExists(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

async function dedupeCategories(eventId: string) {
  const categories = await prisma.eventDrinkCategory.findMany({
    where: { eventId },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const keepBySlug = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const category of categories) {
    const keptId = keepBySlug.get(category.slug);
    if (keptId) {
      duplicateIds.push(category.id);
      continue;
    }
    keepBySlug.set(category.slug, category.id);
  }

  if (duplicateIds.length === 0) {
    return;
  }

  for (const duplicateId of duplicateIds) {
    const duplicate = categories.find((category) => category.id === duplicateId);
    if (!duplicate) {
      continue;
    }

    const keepId = keepBySlug.get(duplicate.slug);
    if (!keepId) {
      continue;
    }

    await prisma.eventDrinkProduct.updateMany({
      where: { categoryId: duplicateId },
      data: { categoryId: keepId },
    });
  }

  await prisma.eventDrinkCategory.deleteMany({
    where: { id: { in: duplicateIds } },
  });
}

async function ensureDefaultCategories(eventId: string) {
  await dedupeCategories(eventId);

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.eventDrinkCategory.upsert({
      where: {
        eventId_slug: {
          eventId,
          slug: category.slug,
        },
      },
      create: {
        eventId,
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        displayOrder: category.displayOrder,
      },
      update: {},
    });
  }
}

function resolveStock(
  stockTotal?: number | null,
  stockRemaining?: number | null,
): { stockTotal: number | null; stockRemaining: number | null } {
  if (stockTotal == null) {
    return { stockTotal: null, stockRemaining: null };
  }

  const remaining = stockRemaining ?? stockTotal;
  return {
    stockTotal,
    stockRemaining: Math.min(remaining, stockTotal),
  };
}

function resolveStatus(
  status: EventDrinkProductStatus | undefined,
  stockRemaining: number | null,
): EventDrinkProductStatus {
  if (status) {
    return status;
  }
  if (stockRemaining != null && stockRemaining <= 0) {
    return 'sold_out';
  }
  return 'available';
}

export const adminEventDrinksService = {
  async listCategories(eventId: string) {
    await assertEventExists(eventId);
    await ensureDefaultCategories(eventId);

    const categories = await prisma.eventDrinkCategory.findMany({
      where: { eventId },
      orderBy: { displayOrder: 'asc' },
    });

    return categories.map(formatAdminEventDrinkCategory);
  },

  async createCategory(eventId: string, input: AdminEventDrinkCategoryInput) {
    await assertEventExists(eventId);

    const slug = input.slug ?? slugifyName(input.name);
    const existing = await prisma.eventDrinkCategory.findFirst({
      where: { eventId, slug },
    });
    if (existing) {
      throw new AppError(409, 'DRINK_CATEGORY_EXISTS', 'Category slug already exists');
    }

    const category = await prisma.eventDrinkCategory.create({
      data: {
        eventId,
        slug,
        name: input.name.trim(),
        icon: input.icon ?? null,
        displayOrder: input.display_order ?? 0,
      },
    });

    return formatAdminEventDrinkCategory(category);
  },

  async listProducts(eventId: string, categorySlug?: string) {
    await assertEventExists(eventId);

    const category = categorySlug
      ? await prisma.eventDrinkCategory.findFirst({
          where: { eventId, slug: categorySlug },
        })
      : null;

    const products = await prisma.eventDrinkProduct.findMany({
      where: {
        eventId,
        ...(category ? { categoryId: category.id } : {}),
      },
      include: { category: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return products.map(formatAdminEventDrinkProduct);
  },

  async createProduct(eventId: string, input: AdminEventDrinkProductInput) {
    await assertEventExists(eventId);

    let categoryId: string | null = input.category_id ?? null;
    if (categoryId) {
      const category = await prisma.eventDrinkCategory.findFirst({
        where: { id: categoryId, eventId },
      });
      if (!category) {
        throw new AppError(404, 'DRINK_CATEGORY_NOT_FOUND', 'Category not found');
      }
    }

    const stock = resolveStock(input.stock_total, input.stock_remaining);
    const status = resolveStatus(input.status, stock.stockRemaining);

    const product = await prisma.eventDrinkProduct.create({
      data: {
        eventId,
        categoryId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        volumeMl: input.volume_ml ?? null,
        priceClp: input.price_clp,
        imageUrl: input.image_url ?? null,
        stockTotal: stock.stockTotal,
        stockRemaining: stock.stockRemaining,
        status,
        displayOrder: input.display_order ?? 0,
        isRecommended: input.is_recommended ?? false,
      },
      include: { category: true },
    });

    return formatAdminEventDrinkProduct(product);
  },

  async updateProduct(
    eventId: string,
    productId: string,
    input: Partial<AdminEventDrinkProductInput>,
  ) {
    const existing = await prisma.eventDrinkProduct.findFirst({
      where: { id: productId, eventId },
      include: { category: true },
    });
    if (!existing) {
      throw new AppError(404, 'DRINK_PRODUCT_NOT_FOUND', 'Drink product not found');
    }

    let categoryId = existing.categoryId;
    if (input.category_id !== undefined) {
      if (input.category_id == null) {
        categoryId = null;
      } else {
        const category = await prisma.eventDrinkCategory.findFirst({
          where: { id: input.category_id, eventId },
        });
        if (!category) {
          throw new AppError(404, 'DRINK_CATEGORY_NOT_FOUND', 'Category not found');
        }
        categoryId = category.id;
      }
    }

    const stockTotal = input.stock_total !== undefined ? input.stock_total : existing.stockTotal;
    const stockRemaining =
      input.stock_remaining !== undefined ? input.stock_remaining : existing.stockRemaining;
    const stock = resolveStock(stockTotal, stockRemaining);
    const status = resolveStatus(
      input.status ?? existing.status,
      stock.stockRemaining,
    );

    const product = await prisma.eventDrinkProduct.update({
      where: { id: existing.id },
      data: {
        categoryId,
        name: input.name?.trim() ?? undefined,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : undefined,
        volumeMl: input.volume_ml !== undefined ? input.volume_ml : undefined,
        priceClp: input.price_clp !== undefined ? input.price_clp : undefined,
        imageUrl: input.image_url !== undefined ? input.image_url : undefined,
        stockTotal: stock.stockTotal,
        stockRemaining: stock.stockRemaining,
        status,
        displayOrder: input.display_order !== undefined ? input.display_order : undefined,
        isRecommended:
          input.is_recommended !== undefined ? input.is_recommended : undefined,
      },
      include: { category: true },
    });

    return formatAdminEventDrinkProduct(product);
  },

  async duplicateProduct(eventId: string, productId: string) {
    const existing = await prisma.eventDrinkProduct.findFirst({
      where: { id: productId, eventId },
    });
    if (!existing) {
      throw new AppError(404, 'DRINK_PRODUCT_NOT_FOUND', 'Drink product not found');
    }

    const product = await prisma.eventDrinkProduct.create({
      data: {
        eventId,
        categoryId: existing.categoryId,
        name: `${existing.name} (copy)`,
        description: existing.description,
        volumeMl: existing.volumeMl,
        priceClp: existing.priceClp,
        imageUrl: existing.imageUrl,
        stockTotal: existing.stockTotal,
        stockRemaining: existing.stockRemaining,
        status: existing.status,
        displayOrder: existing.displayOrder + 1,
        isRecommended: existing.isRecommended,
      },
      include: { category: true },
    });

    return formatAdminEventDrinkProduct(product);
  },

  async deleteProduct(eventId: string, productId: string) {
    const existing = await prisma.eventDrinkProduct.findFirst({
      where: { id: productId, eventId },
    });
    if (!existing) {
      throw new AppError(404, 'DRINK_PRODUCT_NOT_FOUND', 'Drink product not found');
    }

    await prisma.eventDrinkProduct.delete({ where: { id: existing.id } });
  },
};
