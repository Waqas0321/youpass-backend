import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { ticketOrdersService } from '../src/modules/ticket-orders/ticket-orders.service.js';

async function main() {
  const phone = process.argv[2] ?? '+923205905161';
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) throw new Error(`user not found: ${phone}`);

  const orderId = process.argv[3] ?? '6a317d6618cde5ccb1133048';
  const slotId = process.argv[4] ?? '6a317d6618cde5ccb113304a';

  const result = await ticketOrdersService.cancelAssignment(user.id, orderId, slotId);
  console.log('CANCELLED slot', result.slot.id, 'status=', result.slot.status);

  const listed = await ticketOrdersService.listAssignments(user.id, orderId);
  console.log('available=', listed.available_count, 'pending=', listed.pending_count);
  for (const s of listed.slots) {
    console.log(' slot', s.slot_number, s.status, s.guest_phone ?? '-');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
