import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';

async function main() {
  const phone = process.argv[2] ?? '+56988777123';
  const user = await prisma.user.findFirst({ where: { phone } });
  console.log('USER', user?.id, user?.fullName, user?.phone);

  const invitations = await prisma.invitation.findMany({
    where: { recipientPhone: phone },
    orderBy: { sentAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      recipientName: true,
      recipientUserId: true,
      recipientPhone: true,
      source: true,
      sentAt: true,
      viewedAt: true,
      inviterUserId: true,
    },
  });
  console.log('\nALL_INVITATIONS_FOR_PHONE:', invitations.length);
  for (const inv of invitations) {
    console.log(inv);
  }

  if (user) {
    const summary = await invitationsService.getSummary(user.id, user.phone);
    console.log('\nSUMMARY', summary);

    const newCount = await prisma.invitation.count({
      where: {
        OR: [{ recipientUserId: user.id }, { recipientPhone: phone, recipientUserId: null }],
        status: 'sent',
        viewedAt: null,
      },
    });
    const newCountNoViewedFilter = await prisma.invitation.count({
      where: {
        OR: [{ recipientUserId: user.id }, { recipientPhone: phone, recipientUserId: null }],
        status: 'sent',
      },
    });
    console.log('RAW newCount with viewedAt null:', newCount);
    console.log('RAW newCount status sent only:', newCountNoViewedFilter);
  } else {
    console.log('\nNo registered user — badge only works after login with this phone');
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
