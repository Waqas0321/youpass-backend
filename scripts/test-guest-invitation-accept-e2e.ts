/**
 * Verify guest app invitation flow (list, detail, status, accept).
 * Usage: npx tsx scripts/test-guest-invitation-accept-e2e.ts [phone] [invitationId]
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';

const phone = process.argv[2] ?? '+923205905161';
const invitationIdArg = process.argv[3];

async function main() {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    throw new Error(`No user for phone ${phone}`);
  }

  const invitation =
    invitationIdArg != null
      ? await prisma.invitation.findUnique({
          where: { id: invitationIdArg },
          include: { event: true, ticket: true },
        })
      : await prisma.invitation.findFirst({
          where: {
            recipientPhone: phone,
            status: { in: ['sent', 'viewed', 'accepted', 'validated'] },
          },
          include: { event: true, ticket: true },
          orderBy: { sentAt: 'desc' },
        });

  if (!invitation) {
    throw new Error('No invitation found to test');
  }

  console.log('User:', user.fullName, user.phone);
  console.log('Invitation:', {
    id: invitation.id,
    event: invitation.event.title,
    status: invitation.status,
    type: invitation.type,
    source: invitation.source,
    entryValue: invitation.entryValue,
  });

  const list = await invitationsService.listInvitations(user.id, user.phone, {});
  const listed = list.invitations.find((item) => item.id === invitation.id);
  if (!listed) {
    throw new Error('Invitation missing from GET /invitations list');
  }
  console.log('✓ Listed in app invitations:', listed.status);

  const detail = await invitationsService.getInvitationDetail(user.id, user.phone, invitation.id);
  console.log('✓ Detail loaded:', detail.status, detail.product_kind ?? detail.type);

  const status = await invitationsService.getInvitationStatus(user.id, user.phone, invitation.id);
  console.log('✓ Status endpoint:', status.status, status.can_confirm ? 'can_confirm' : 'locked');

  if (['sent', 'viewed'].includes(invitation.status)) {
    const accepted = await invitationsService.acceptInvitation(user.id, user.phone, invitation.id, {
      accept_charge_terms: true,
    });
    console.log('✓ Accept/confirm succeeded:', accepted.status, accepted.entry_code ? 'entry_code ok' : 'no entry_code yet');

    const after = await invitationsService.getInvitationStatus(user.id, user.phone, invitation.id);
    console.log('✓ Status after accept:', after.status);
  } else {
    console.log('• Skipped accept — invitation already', invitation.status);
  }

  const rejectCandidate = await prisma.invitation.findFirst({
    where: {
      recipientPhone: phone,
      status: { in: ['sent', 'viewed'] },
      id: { not: invitation.id },
    },
  });
  if (rejectCandidate) {
    const rejected = await invitationsService.rejectInvitation(user.id, user.phone, rejectCandidate.id);
    console.log('✓ Reject flow works on secondary invite:', rejected.status);
  } else {
    console.log('• Skipped reject test — no second pending invitation');
  }
}

main()
  .catch((error) => {
    console.error('✗', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
