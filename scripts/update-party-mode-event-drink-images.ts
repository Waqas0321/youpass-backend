import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const EVENT_TITLE = 'Lahore Beats Festival';

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

async function main() {
  const event = await prisma.event.findFirst({ where: { title: EVENT_TITLE } });
  if (!event) {
    throw new Error(`Event not found: ${EVENT_TITLE}`);
  }

  const products = await prisma.eventDrinkProduct.findMany({
    where: { eventId: event.id },
    orderBy: { displayOrder: 'asc' },
  });

  const updates = [];
  for (const product of products) {
    const imageUrl = DRINK_IMAGES_BY_NAME[product.name];
    if (!imageUrl) {
      continue;
    }

    await prisma.eventDrinkProduct.update({
      where: { id: product.id },
      data: { imageUrl },
    });

    updates.push({ name: product.name, imageUrl });
  }

  console.log(
    JSON.stringify(
      {
        event: { id: event.id, title: event.title },
        updated: updates.length,
        products: updates,
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
