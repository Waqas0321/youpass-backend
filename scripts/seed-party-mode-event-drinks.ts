import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { adminEventDrinksService } from '../src/modules/admin/admin-event-drinks.service.js';
import { eventDrinksService } from '../src/modules/event-drinks/event-drinks.service.js';

const PHONE = '+923205905162';

const DRINK_IMAGES_BY_NAME: Record<string, string> = {
  Piscola:
    'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80',
  'Cuba Libre':
    'https://images.unsplash.com/photo-1551024709-8f03bef6176a?auto=format&fit=crop&w=640&q=80',
  'Tropical Gin':
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d46?auto=format&fit=crop&w=640&q=80',
  Corona:
    'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=640&q=80',
  'Jager Bomb':
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=640&q=80',
  'Chandon Brut':
    'https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=640&q=80',
  'Mineral Water':
    'https://images.unsplash.com/photo-1548839140-29a7492991a9?auto=format&fit=crop&w=640&q=80',
};

const SAMPLE_PRODUCTS = [
  {
    categorySlug: 'piscolas',
    name: 'Piscola',
    description: 'Pisco with cola',
    volumeMl: 350,
    priceClp: 4500,
    isRecommended: true,
    displayOrder: 1,
  },
  {
    categorySlug: 'piscolas',
    name: 'Cuba Libre',
    description: 'Rum, cola and lime',
    volumeMl: 350,
    priceClp: 4200,
    displayOrder: 2,
  },
  {
    categorySlug: 'gin',
    name: 'Tropical Gin',
    description: 'Gin with tropical mix',
    volumeMl: 350,
    priceClp: 6000,
    isRecommended: true,
    displayOrder: 3,
  },
  {
    categorySlug: 'cervezas',
    name: 'Corona',
    description: 'Imported lager',
    volumeMl: 330,
    priceClp: 3500,
    displayOrder: 4,
  },
  {
    categorySlug: 'energeticas',
    name: 'Jager Bomb',
    description: 'Jägermeister with energy drink',
    volumeMl: 250,
    priceClp: 5000,
    isRecommended: true,
    displayOrder: 5,
  },
  {
    categorySlug: 'espumantes',
    name: 'Chandon Brut',
    description: 'Sparkling wine bottle',
    volumeMl: 750,
    priceClp: 12000,
    displayOrder: 6,
  },
  {
    categorySlug: 'agua-bebidas',
    name: 'Mineral Water',
    description: 'Still water 500ml',
    volumeMl: 500,
    priceClp: 1500,
    displayOrder: 7,
  },
] as const;

async function loadTicketedEventIds(userId: string) {
  const invitations = await prisma.invitation.findMany({
    where: { recipientUserId: userId },
    select: { id: true },
  });

  if (invitations.length === 0) {
    return [];
  }

  const paidSlots = await prisma.ticketSlot.findMany({
    where: {
      invitationId: { in: invitations.map((row) => row.id) },
      order: { status: 'paid' },
    },
    include: {
      order: { select: { eventId: true } },
    },
  });

  const eventIds = [...new Set(paidSlots.map((slot) => slot.order.eventId))];
  return prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, title: true },
  });
}

async function seedDrinksForEvent(eventId: string, eventTitle: string) {
  await adminEventDrinksService.listCategories(eventId);

  const existingProducts = await prisma.eventDrinkProduct.count({
    where: { eventId, status: { not: 'hidden' } },
  });

  if (existingProducts > 0) {
    return {
      eventId,
      eventTitle,
      seeded: false,
      existingProducts,
    };
  }

  const categories = await prisma.eventDrinkCategory.findMany({
    where: { eventId },
  });
  const categoryBySlug = new Map(categories.map((row) => [row.slug, row.id]));

  let created = 0;
  for (const product of SAMPLE_PRODUCTS) {
    const categoryId = categoryBySlug.get(product.categorySlug);
    if (!categoryId) {
      continue;
    }

    await adminEventDrinksService.createProduct(eventId, {
      category_id: categoryId,
      name: product.name,
      description: product.description,
      volume_ml: product.volumeMl,
      price_clp: product.priceClp,
      image_url: DRINK_IMAGES_BY_NAME[product.name] ?? null,
      is_recommended: product.isRecommended ?? false,
      display_order: product.displayOrder,
      status: 'available',
    });
    created += 1;
  }

  return {
    eventId,
    eventTitle,
    seeded: true,
    created,
  };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const events = await loadTicketedEventIds(user.id);
  if (events.length === 0) {
    throw new Error(`No paid ticket events found for ${PHONE}`);
  }

  const results = [];
  for (const event of events) {
    results.push(await seedDrinksForEvent(event.id, event.title));
  }

  const menuPreview = [];
  for (const event of events) {
    const menu = await eventDrinksService.getMenuForUser(user.id, event.id);
    menuPreview.push({
      eventId: event.id,
      eventTitle: event.title,
      categories: menu.categories.length,
      products: menu.products.length,
      sampleProducts: menu.products.slice(0, 3).map((product) => product.name),
    });
  }

  console.log(
    JSON.stringify(
      {
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        seedResults: results,
        menuPreview,
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
