import { prisma } from '../src/config/database.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';

const invitationId = process.argv[2] ?? '6a2e2cdcb9a264690b7bf860';

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: '+56912345678' },
  });

  if (!user) {
    console.log('NO USER');
    process.exit(1);
  }

  console.log('User:', user.phone, user.id);
  console.log('Invitation:', invitationId);

  const paymentMethods = await prisma.userPaymentMethod.count({
    where: { userId: user.id, isDefault: true },
  });
  console.log('Default payment methods:', paymentMethods);

  try {
    const result = await invitationsService.confirmInvitation(
      user.id,
      user.phone,
      invitationId,
      { accept_charge_terms: true },
    );
    console.log('OK', result.id, result.status);
  } catch (error) {
    console.error('FAIL', error);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main();
