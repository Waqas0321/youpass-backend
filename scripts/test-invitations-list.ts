import { prisma } from '../src/config/database.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { accountStatus: 'active' } });
  if (!user) {
    console.log('NO USER');
    process.exit(1);
  }

  console.log('User:', user.phone, user.id);

  try {
    const result = await invitationsService.listInvitations(user.id, user.phone, {});
    console.log('OK', result.invitations.length, 'invitations');
    if (result.invitations[0]) {
      console.log(JSON.stringify(result.invitations[0], null, 2));
    }
  } catch (error) {
    console.error('FAIL', error);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main();
