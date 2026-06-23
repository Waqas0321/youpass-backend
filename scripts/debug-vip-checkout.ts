import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { vipVenueService } from '../src/modules/vip-venue/vip-venue.service.js';
import { ticketOrdersService } from '../src/modules/ticket-orders/ticket-orders.service.js';

async function main() {
  const eventId = '6a302d1bbcaeb4edec4b23ea';
  const tableRef = 'table-vip-1-m2';

  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) {
    console.log('no user');
    return;
  }

  const table = await prisma.venueTable.findFirst({
    where: { eventId, externalId: tableRef },
    include: { zone: true },
  });
  if (!table) {
    console.log('table not found');
    return;
  }

  await vipVenueService.lockTable(eventId, tableRef, user.id);

  try {
    const result = await ticketOrdersService.checkout(user.id, eventId, {
      table_id: tableRef,
      zone_id: table.zone.externalId,
      tier: 'vip',
      type: 'vip_table',
    });
    console.log('checkout ok:', {
      status: result.status,
      gateway: result.gateway ?? result.payment_gateway,
      payment_url: 'payment_url' in result ? result.payment_url : null,
      total: result.total_amount,
    });
  } catch (error) {
    console.error('checkout failed:', error);
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
