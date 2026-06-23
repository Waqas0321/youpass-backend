import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { eventDrinkOrdersService } from '../src/modules/event-drinks/event-drink-orders.service.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: '+923205905162' } });
  if (!user) {
    throw new Error('User not found');
  }

  const eventId = '6a302d1bbcaeb4edec4b23ea';
  const productId = '6a3ac4e2b1ed3e47d0c09987';

  const product = await prisma.eventDrinkProduct.findUnique({ where: { id: productId } });
  console.log('product stock:', product?.stockRemaining, 'price:', product?.priceClp);

  try {
    const order = await eventDrinkOrdersService.createOrder(user.id, eventId, {
      items: [{ product_id: productId, quantity: 1 }],
    });
    console.log('OK', {
      orderId: order.order_id,
      isComplimentary: order.is_complimentary,
      totalClp: order.total_clp,
    });
  } catch (error) {
    console.error('createOrder failed:', error);
  }
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
