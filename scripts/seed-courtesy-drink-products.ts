import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

const PHONE = '+923205905162';
const EVENT_TITLE = 'Lahore Beats Festival';

const COURTESY_PRODUCTS = [
  {
    categorySlug: 'energeticas',
    name: 'Red Bull (Courtesy)',
    description: 'Complimentary energy drink',
    volumeMl: 250,
    priceClp: 0,
    displayOrder: 101,
    imageUrl:
      'https://images.unsplash.com/photo-1622543563224-0b2d8b0b0b0b?auto=format&fit=crop&w=640&q=80',
  },
  {
    categorySlug: 'energeticas',
    name: 'Jager Bomb (Courtesy)',
    description: 'Complimentary Jäger Bomb',
    volumeMl: 250,
    priceClp: 0,
    displayOrder: 102,
    imageUrl:
      'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=640&q=80',
  },
  {
    categorySlug: 'gin',
    name: 'Tropical Gin (Courtesy)',
    description: 'Complimentary tropical gin',
    volumeMl: 350,
    priceClp: 0,
    displayOrder: 103,
    imageUrl:
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=640&q=80',
  },
] as const;

async function resolveEvent() {
  const byTitle = await prisma.event.findFirst({
    where: { title: EVENT_TITLE },
    select: { id: true, title: true },
  });
  if (byTitle) {
    return byTitle;
  }

  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const invitation = await prisma.invitation.findFirst({
    where: { recipientUserId: user.id },
    select: { id: true },
  });
  if (!invitation) {
    throw new Error(`No invitations found for ${PHONE}`);
  }

  const slot = await prisma.ticketSlot.findFirst({
    where: {
      invitationId: invitation.id,
      order: { status: 'paid' },
    },
    include: {
      order: { select: { eventId: true, event: { select: { title: true } } } },
    },
  });

  if (!slot) {
    throw new Error(`No paid ticket event found for ${PHONE}`);
  }

  return {
    id: slot.order.eventId,
    title: slot.order.event.title,
  };
}

async function ensureCourtesyProducts(eventId: string) {
  const categories = await prisma.eventDrinkCategory.findMany({
    where: { eventId },
  });
  const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]));

  const results = [];
  for (const product of COURTESY_PRODUCTS) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) {
      results.push({
        name: product.name,
        status: 'skipped',
        reason: `Category not found: ${product.categorySlug}`,
      });
      continue;
    }

    const existing = await prisma.eventDrinkProduct.findFirst({
      where: { eventId, name: product.name },
    });

    if (existing) {
      if (existing.priceClp !== 0) {
        await prisma.eventDrinkProduct.update({
          where: { id: existing.id },
          data: { priceClp: 0 },
        });
        results.push({ name: product.name, status: 'updated_price_to_zero', productId: existing.id });
      } else {
        results.push({ name: product.name, status: 'exists', productId: existing.id });
      }
      continue;
    }

    const created = await adminEventDrinksService.createProduct(eventId, {
      category_id: categoryId,
      name: product.name,
      description: product.description,
      volume_ml: product.volumeMl,
      price_clp: product.priceClp,
      image_url: product.imageUrl,
      display_order: product.displayOrder,
      status: 'available',
      stock_total: 50,
      stock_remaining: 50,
    });

    results.push({
      name: product.name,
      status: 'created',
      productId: created.product_id,
    });
  }

  return results;
}

async function seedCourtesyOrders(userId: string, eventId: string) {
  const products = await prisma.eventDrinkProduct.findMany({
    where: {
      eventId,
      priceClp: 0,
      status: { not: 'hidden' },
    },
    orderBy: { displayOrder: 'asc' },
    take: 3,
  });

  if (products.length === 0) {
    return { createdOrders: [], message: 'No free products to order' };
  }

  const createdOrders = [];
  const orderSpecs = [
    { product: products[0], quantity: 2 },
    { product: products[1] ?? products[0], quantity: 1 },
    { product: products[2] ?? products[0], quantity: 1 },
  ];

  for (const spec of orderSpecs) {
    const order = await eventDrinkOrdersService.createOrder(userId, eventId, {
      items: [{ product_id: spec.product.id, quantity: spec.quantity }],
    });
    createdOrders.push({
      orderId: order.order_id,
      displayOrderId: order.display_order_id,
      product: spec.product.name,
      quantity: spec.quantity,
      isComplimentary: order.is_complimentary,
      totalClp: order.total_clp,
    });
  }

  return { createdOrders };
}

async function main() {
  const withOrders = process.argv.includes('--with-orders');
  const event = await resolveEvent();
  const productResults = await ensureCourtesyProducts(event.id);

  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  let orderResults = null;
  if (withOrders) {
    orderResults = await seedCourtesyOrders(user.id, event.id);
  }

  const courtesyList = await eventDrinkOrdersService.listForUser(user.id, {
    complimentary: true,
  });
  const purchasesList = await eventDrinkOrdersService.listForUser(user.id, {
    complimentary: false,
  });

  console.log(
    JSON.stringify(
      {
        event,
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        products: productResults,
        orders: orderResults,
        apiPreview: {
          courtesyOrders: courtesyList.orders.length,
          paidOrders: purchasesList.orders.length,
          courtesySample: courtesyList.orders.slice(0, 3).map((order) => ({
            orderId: order.order_id,
            displayOrderId: order.display_order_id,
            isComplimentary: order.is_complimentary,
            lines: order.line_items.map((line) => line.product_name),
          })),
        },
        nextSteps: withOrders
          ? [
              'Open the app → Cortesías to see seeded courtesy orders.',
              'Or claim free items from Drink Menu (price $0).',
            ]
          : [
              'Run again with --with-orders to create test courtesy orders for TestA.',
              'Or claim free items from Drink Menu in the app.',
            ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
