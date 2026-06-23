import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/config/database.js';
import { partyModeService } from '../src/modules/party-mode/party-mode.service.js';

const PHONE = '+923205905162';
const EVENT_TITLE = 'Lahore Beats Festival';
const LAHORE_LAT = 31.5204;
const LAHORE_LNG = 74.3587;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

async function ensureBypassUserId(userId: string) {
  if (!fs.existsSync(envPath)) {
    console.warn('No .env file found; set PARTY_MODE_BYPASS_USER_IDS manually.');
    return;
  }

  const current = fs.readFileSync(envPath, 'utf8');
  const key = 'PARTY_MODE_BYPASS_USER_IDS';
  const line = `${key}=${userId}`;

  if (current.includes(`${key}=`)) {
    const updated = current.replace(
      new RegExp(`^${key}=.*$`, 'm'),
      (match) => {
        const existing = match.split('=')[1] ?? '';
        const ids = existing
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
        if (ids.includes(userId)) {
          return match;
        }
        return `${key}=${[...ids, userId].join(',')}`;
      },
    );
    fs.writeFileSync(envPath, updated);
    return;
  }

  fs.appendFileSync(envPath, `\n${line}\n`);
}

async function main() {
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) {
    throw new Error(`User not found: ${PHONE}`);
  }

  const event = await prisma.event.findFirst({ where: { title: EVENT_TITLE } });
  if (!event) {
    throw new Error(`Event not found: ${EVENT_TITLE}`);
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      recipientUserId: user.id,
      eventId: event.id,
    },
    include: { ticket: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!invitation?.ticket) {
    throw new Error(`No ticket found for ${PHONE} on ${EVENT_TITLE}`);
  }

  const paidSlot = await prisma.ticketSlot.findFirst({
    where: {
      invitationId: invitation.id,
      order: { status: 'paid' },
    },
  });

  if (!paidSlot) {
    throw new Error(`No paid purchase found for invitation ${invitation.id}`);
  }

  const now = new Date();
  const startsAt = new Date(now.getTime() - 60 * 60 * 1000);
  const endsAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: event.id },
      data: {
        startsAt,
        endsAt,
        latitude: LAHORE_LAT,
        longitude: LAHORE_LNG,
      },
    });

    await tx.invitationTicket.update({
      where: { invitationId: invitation.id },
      data: { validatedAt: now },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'validated' },
    });
  });

  await ensureBypassUserId(user.id);

  const partyMode = await partyModeService.resolveForUser(user.id, {});
  const partyModeAtVenue = await partyModeService.resolveForUser(user.id, {
    lat: LAHORE_LAT,
    lng: LAHORE_LNG,
  });

  console.log(
    JSON.stringify(
      {
        user: { id: user.id, phone: user.phone, fullName: user.fullName },
        event: {
          id: event.id,
          title: EVENT_TITLE,
          startsAt,
          endsAt,
          latitude: LAHORE_LAT,
          longitude: LAHORE_LNG,
        },
        invitation: {
          id: invitation.id,
          status: 'validated',
          scanned_at: now.toISOString(),
        },
        party_mode_without_gps: partyMode,
        party_mode_at_lahore: partyModeAtVenue,
        next_steps: [
          'Restart the backend so PARTY_MODE_BYPASS_USER_IDS is loaded.',
          'Hot restart the Flutter app and pull to refresh Home.',
          'The MODO FIESTA toggle should appear; tap it to enable Party Mode.',
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
