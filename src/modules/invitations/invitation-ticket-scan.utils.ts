import { prisma } from '../../config/database.js';

const ticketDoorInclude = {
  invitation: {
    include: {
      event: true,
      producer: true,
      recipient: true,
      preAuth: true,
    },
  },
} as const;

function normalizeManualEntryCode(value: string): string {
  return value.trim().toUpperCase();
}

function manualEntryCandidates(scanInput: string): string[] {
  const trimmed = scanInput.trim();
  const candidates = new Set<string>();

  if (trimmed.length >= 4 && trimmed.length <= 32) {
    candidates.add(normalizeManualEntryCode(trimmed));
  }

  return [...candidates];
}

export async function findInvitationTicketByScanInput(scanInput: string) {
  const trimmed = scanInput.trim();
  if (!trimmed) {
    return null;
  }

  const byPayload = await prisma.invitationTicket.findFirst({
    where: { qrPayload: trimmed },
    include: ticketDoorInclude,
  });
  if (byPayload) {
    return byPayload;
  }

  for (const manualEntryId of manualEntryCandidates(trimmed)) {
    const byManualEntry = await prisma.invitationTicket.findFirst({
      where: { manualEntryId },
      include: ticketDoorInclude,
    });
    if (byManualEntry) {
      return byManualEntry;
    }
  }

  return null;
}

export { ticketDoorInclude };
