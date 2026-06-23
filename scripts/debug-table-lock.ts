import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { buildVenueTableRefFilter } from '../src/common/utils/mongo-id.js';
import { vipVenueService } from '../src/modules/vip-venue/vip-venue.service.js';

async function main() {
  const eventId = '6a302d1bbcaeb4edec4b23ea';
  const tableRef = 'table-vip-1-m1';

  const table = await prisma.venueTable.findFirst({
    where: { eventId, ...buildVenueTableRefFilter(tableRef) },
  });
  console.log('table:', table?.id, table?.externalId, table?.status);

  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  console.log('user:', user?.id, user?.phone);
  if (!user) {
    return;
  }

  try {
    const result = await vipVenueService.lockTable(eventId, tableRef, user.id);
    console.log('lock ok:', {
      lock_id: result.lock_id,
      expires_at: result.expires_at,
      table_id: result.table?.id,
    });
  } catch (error) {
    console.error('lock failed:', error);
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
