import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { searchSupervisorEntries } from '../src/modules/staff-supervisor/staff-supervisor-entry-search.service.js';
import { formatEntrySearchResults } from '../src/modules/staff-supervisor/staff-supervisor-entry-search.formatter.js';

const PHONE = process.argv[2] ?? '+923205905162';

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

async function main() {
  const digits = phoneDigits(PHONE);
  const now = Date.now();
  const windowStart = new Date(now - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);

  console.log('=== Phone search debug ===');
  console.log('PHONE:', PHONE);
  console.log('DIGITS:', digits);
  console.log('Active event window:', windowStart.toISOString(), '→', windowEnd.toISOString());
  console.log('');

  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  console.log('USER:', user ? { id: user.id, name: user.fullName, phone: user.phone } : null);

  const invitations = await prisma.invitation.findMany({
    where: {
      OR: [
        { recipientPhone: PHONE },
        { recipientPhone: { contains: digits } },
        ...(user ? [{ recipientUserId: user.id }] : []),
      ],
    },
    orderBy: { sentAt: 'desc' },
    take: 20,
    include: {
      event: { select: { id: true, title: true, startsAt: true, venueName: true } },
      ticket: {
        select: {
          id: true,
          manualEntryId: true,
          qrPayload: true,
          validatedAt: true,
        },
      },
    },
  });

  console.log('\nINVITATIONS:', invitations.length);
  for (const inv of invitations) {
    const inWindow =
      inv.event.startsAt >= windowStart && inv.event.startsAt <= windowEnd;
    const hasTicket = Boolean(inv.ticket);
    const searchableStatus = ['accepted', 'validated', 'rejected', 'expired', 'canceled', 'failed'].includes(
      inv.status,
    );
    console.log({
      invitationId: inv.id,
      status: inv.status,
      tier: inv.tier,
      recipientName: inv.recipientName,
      recipientPhone: inv.recipientPhone,
      eventTitle: inv.event.title,
      eventStartsAt: inv.event.startsAt.toISOString(),
      inActiveWindow: inWindow,
      hasTicket,
      searchableStatus,
      ticket: inv.ticket,
    });
  }

  const scanLogs = await prisma.staffScanLog.findMany({
    where: {
      OR: [
        { guestName: { contains: user?.fullName ?? 'TestA', mode: 'insensitive' } },
        ...(invitations.flatMap((inv) =>
          inv.ticket?.qrPayload
            ? [{ qrPayload: inv.ticket.qrPayload }]
            : [],
        )),
      ],
    },
    orderBy: { scannedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      scannedAt: true,
      outcome: true,
      scanType: true,
      guestName: true,
      eventTitle: true,
      entryId: true,
      qrPayload: true,
    },
  });

  console.log('\nRECENT SCAN LOGS:', scanLogs.length);
  for (const log of scanLogs) {
    console.log(log);
  }

  console.log('\n--- searchSupervisorEntries ---');
  for (const q of [PHONE, digits, PHONE.replace('+', ''), '923205905162']) {
    const tickets = await searchSupervisorEntries({ q });
    console.log(`q="${q}" → ${tickets.length} ticket(s)`);
    for (const t of tickets) {
      console.log(' ', {
        ticketId: t.id,
        guest: t.invitation.recipientName,
        phone: t.invitation.recipientPhone,
        event: t.invitation.event.title,
        status: t.invitation.status,
        validatedAt: t.validatedAt,
      });
    }
  }

  console.log('\n--- Sample searchable entries (any phone, active window) ---');
  const samples = await prisma.invitationTicket.findMany({
    where: {
      invitation: {
        status: { in: ['accepted', 'validated'] },
        event: {
          startsAt: { gte: windowStart, lte: windowEnd },
        },
      },
    },
    include: {
      invitation: {
        include: {
          event: { select: { title: true, startsAt: true } },
        },
      },
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
  });

  for (const t of samples) {
    console.log({
      searchBy: t.invitation.recipientPhone || t.manualEntryId || t.qrPayload?.slice(0, 20),
      guest: t.invitation.recipientName,
      phone: t.invitation.recipientPhone,
      event: t.invitation.event.title,
      manualEntryId: t.manualEntryId,
      qrPayload: t.qrPayload?.slice(0, 40),
      status: t.invitation.status,
      validatedAt: t.validatedAt,
    });
  }

  const formatted = await formatEntrySearchResults(
    await searchSupervisorEntries({ q: PHONE }),
  );
  console.log('\nFormatted API response for phone:', JSON.stringify(formatted, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
