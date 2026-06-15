import { prisma } from '../src/config/database.js';
import { vipVenueService } from '../src/modules/vip-venue/vip-venue.service.js';

const eventId = process.argv[2] ?? '6a2d8798e8918975dcd71b92';

try {
  const data = await vipVenueService.getVenueLayout(eventId);
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('FAILED:', error);
} finally {
  await prisma.$disconnect();
}
