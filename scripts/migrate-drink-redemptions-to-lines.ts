import { prisma } from '../src/config/database.js';
import { generateEntryCode, generateQrPayload } from '../src/modules/invitations/invitations.utils.js';

async function generateUniqueEntryCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateEntryCode();
    const existing = await prisma.eventDrinkRedemption.findUnique({
      where: { manualEntryId: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }
  throw new Error('Could not generate entry code');
}

async function generateUniqueQrPayload(lineId: string, eventId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const payload = generateQrPayload(lineId, eventId);
    const existing = await prisma.eventDrinkRedemption.findUnique({
      where: { qrPayload: payload },
      select: { id: true },
    });
    if (!existing) {
      return payload;
    }
  }
  throw new Error('Could not generate QR payload');
}

async function dropLegacyOrderIdUniqueIndex() {
  try {
    await prisma.$runCommandRaw({
      dropIndexes: 'event_drink_redemptions',
      index: 'event_drink_redemptions_order_id_key',
    });
    console.log('Dropped legacy unique index on order_id');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('index not found') || message.includes('ns not found')) {
      console.log('Legacy order_id unique index already absent');
      return;
    }
    console.warn('Could not drop legacy order_id index:', message);
  }
}

async function main() {
  await dropLegacyOrderIdUniqueIndex();

  const orders = await prisma.eventDrinkOrder.findMany({
    include: {
      lines: { orderBy: { createdAt: 'asc' } },
      redemptions: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  let linked = 0;

  for (const order of orders) {
    const orphanRedemptions = order.redemptions.filter((redemption) => redemption.lineId == null);

    for (const orphan of orphanRedemptions) {
      const unassignedLine = order.lines.find(
        (line) => !order.redemptions.some((redemption) => redemption.lineId === line.id),
      );
      const targetLine = unassignedLine ?? order.lines[0];
      if (!targetLine) {
        continue;
      }

      await prisma.eventDrinkRedemption.update({
        where: { id: orphan.id },
        data: { lineId: targetLine.id },
      });
      linked += 1;
      order.redemptions = order.redemptions.map((redemption) =>
        redemption.id === orphan.id ? { ...redemption, lineId: targetLine.id } : redemption,
      );
    }

    for (const line of order.lines) {
      const existing = order.redemptions.find((redemption) => redemption.lineId === line.id);
      if (existing) {
        continue;
      }

      const template = order.redemptions[0];
      const manualEntryId = await generateUniqueEntryCode();
      const qrPayload = await generateUniqueQrPayload(line.id, order.eventId);

      await prisma.eventDrinkRedemption.create({
        data: {
          orderId: order.id,
          lineId: line.id,
          manualEntryId,
          qrPayload,
          unlockAt: template?.unlockAt ?? new Date(),
          validatedAt: template?.validatedAt ?? null,
        },
      });
      created += 1;
      console.log(`Created redemption ${manualEntryId} for ${line.productName} on order ${order.id.slice(-5)}`);
    }
  }

  const remainingOrphans = await prisma.eventDrinkRedemption.count({
    where: { lineId: null },
  });

  console.log(`Linked orphan redemptions: ${linked}`);
  console.log(`Created line redemptions: ${created}`);
  console.log(`Remaining without line_id: ${remainingOrphans}`);
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
