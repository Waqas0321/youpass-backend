/**
 * Seed drink orders + reset one entry ticket for staff QA on a fresh cluster.
 * Run: npx tsx scripts/seed-staff-qa-scan-data.ts
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

const PHONE = '+56988777123';
const EVENT_TITLE = 'Sunset Sessions';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const event = await prisma.event.findFirst({ where: { title: EVENT_TITLE } });
  if (!event) {
    throw new Error(`Event not found: ${EVENT_TITLE}`);
  }

  await adminEventDrinksService.listCategories(event.id);
  const categories = await prisma.eventDrinkCategory.findMany({ where: { eventId: event.id } });
  const bySlug = new Map(categories.map((category) => [category.slug, category.id]));

  let free = await prisma.eventDrinkProduct.findFirst({
    where: { eventId: event.id, priceClp: 0, status: { not: 'hidden' } },
  });

  if (!free) {
    const categoryId =
      bySlug.get('agua-bebidas') ?? bySlug.get('energeticas') ?? categories[0]?.id;
    if (!categoryId) {
      throw new Error('No drink categories on event');
    }

    const created = await adminEventDrinksService.createProduct(event.id, {
      category_id: categoryId,
      name: 'Water (Courtesy)',
      description: 'Complimentary water for staff QA',
      volume_ml: 500,
      price_clp: 0,
      display_order: 200,
      status: 'available',
      stock_total: 100,
      stock_remaining: 100,
    });

    free = await prisma.eventDrinkProduct.findUniqueOrThrow({
      where: { id: created.product_id },
    });
    console.log(`created free product: ${free.name}`);
  }

  const existingOrders = await prisma.eventDrinkOrder.count({ where: { userId: user.id } });
  if (existingOrders === 0) {
    const order = await eventDrinkOrdersService.createOrder(user.id, event.id, {
      items: [{ product_id: free.id, quantity: 2 }],
    });
    console.log(`created courtesy order ${order.display_order_id}`);
  } else {
    console.log(`orders already exist: ${existingOrders}`);
  }

  const invitation = await prisma.invitation.findFirst({
    where: { recipientUserId: user.id, ticket: { isNot: null } },
    include: { ticket: true, event: true },
    orderBy: { createdAt: 'asc' },
  });

  if (invitation?.ticket) {
    await prisma.invitationTicket.update({
      where: { id: invitation.ticket.id },
      data: { validatedAt: null },
    });
    console.log(
      `cleared ticket validation: ${invitation.ticket.manualEntryId} (${invitation.event.title})`,
    );
  }

  const redemptions = await prisma.eventDrinkRedemption.findMany({
    where: { order: { userId: user.id } },
    select: { manualEntryId: true, validatedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(
    JSON.stringify(
      {
        user: user.fullName,
        event: event.title,
        redemptions,
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
  .finally(() => prisma.$disconnect());
