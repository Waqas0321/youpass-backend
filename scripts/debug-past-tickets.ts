import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { ticketsService } from '../src/modules/tickets/tickets.service.js';

async function main() {
  const phone = process.argv[2] ?? '+923205905161';
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    console.log('no user');
    return;
  }

  try {
    const past = await ticketsService.listPast(user.id, { page: 1, limit: 20 });
    console.log('listPast OK', past.tickets.length, past.meta);
  } catch (error) {
    console.error('listPast FAILED');
    console.error(error);
  }

  try {
    const summary = await ticketsService.getYearlySummary(user.id);
    console.log('getYearlySummary OK', summary);
  } catch (error) {
    console.error('getYearlySummary FAILED');
    console.error(error);
  }
}

main().finally(() => prisma.$disconnect());
