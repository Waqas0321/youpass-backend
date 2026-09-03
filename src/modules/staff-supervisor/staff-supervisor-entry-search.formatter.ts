import { prisma } from '../../config/database.js';
import {
  buildVipTags,
  formatPurchaseId,
  formatTimeLabel,
  resolveEntryStatus,
  searchSupervisorEntries,
  type TicketWithInvitation,
} from './staff-supervisor-entry-search.service.js';

type OrderContext = {
  id: string;
  paymentReference: string | null;
  quantity: number;
  status: string;
  venueTableId: string | null;
  venueZoneId: string | null;
  slots: Array<{ invitationId: string | null }>;
};

async function resolveOrderContext(invitationId: string): Promise<OrderContext | null> {
  const slot = await prisma.ticketSlot.findFirst({
    where: { invitationId },
    include: {
      order: {
        include: {
          slots: true,
        },
      },
    },
  });

  return slot?.order ?? null;
}

async function resolveVipTableLabel(order: OrderContext | null) {
  if (!order?.venueTableId) {
    return null;
  }

  const table = await prisma.venueTable.findUnique({
    where: { id: order.venueTableId },
    select: { label: true },
  });

  if (!table?.label) {
    return null;
  }

  return table.label.startsWith('Mesa') ? table.label : `Mesa ${table.label}`;
}

async function resolveVipTags(
  invitation: TicketWithInvitation['invitation'],
  order: OrderContext | null,
) {
  const tags = buildVipTags(invitation);

  if (order?.venueZoneId) {
    const zone = await prisma.venueZone.findUnique({
      where: { id: order.venueZoneId },
      select: { name: true },
    });

    if (zone?.name && !tags.includes(zone.name)) {
      tags.unshift(zone.name);
    }
  }

  return tags;
}

async function resolveAssociatedEntries(order: OrderContext | null) {
  if (!order) {
    return { label: null, used: null, total: null };
  }

  const invitationIds = order.slots
    .map((slot) => slot.invitationId)
    .filter((id): id is string => Boolean(id));

  if (invitationIds.length === 0) {
    return { label: `0 / ${order.quantity}`, used: 0, total: order.quantity };
  }

  const validatedCount = await prisma.invitationTicket.count({
    where: {
      invitationId: { in: invitationIds },
      validatedAt: { not: null },
    },
  });

  return {
    label: `${validatedCount} / ${order.quantity}`,
    used: validatedCount,
    total: order.quantity,
  };
}

function formatValidatorDetail(staffMember: {
  name: string;
  zone: { label: string; slug: string };
}) {
  const zoneCode = staffMember.zone.label
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '');

  if (zoneCode.length >= 3) {
    return zoneCode;
  }

  return staffMember.name;
}

async function resolveValidatorLabel(manualEntryId: string) {
  const latestScan = await prisma.staffScanLog.findFirst({
    where: {
      entryId: manualEntryId,
      scanType: 'entry',
      outcome: 'valid',
    },
    orderBy: { scannedAt: 'desc' },
    include: {
      staffMember: {
        include: { zone: true },
      },
    },
  });

  if (!latestScan) {
    return null;
  }

  return formatValidatorDetail(latestScan.staffMember);
}

async function resolveEntryEvents(
  invitationId: string,
  manualEntryId: string,
  countryCode: string,
  options?: { previewLimit?: number },
) {
  const logTake = options?.previewLimit ? 10 : 100;

  const [scanLogs, auditLogs] = await Promise.all([
    prisma.staffScanLog.findMany({
      where: {
        entryId: manualEntryId,
        scanType: 'entry',
      },
      orderBy: { scannedAt: 'asc' },
      take: logTake,
      include: {
        staffMember: {
          include: { zone: true, role: true },
        },
      },
    }),
    prisma.invitationAuditLog.findMany({
      where: { invitationId },
      orderBy: { createdAt: 'asc' },
      take: logTake,
    }),
  ]);

  const scanEvents = scanLogs.map((log) => {
    const isSupervisor = log.staffMember.permissionIds.some((permissionId) =>
      ['tickets_supervisor', 'general_admin'].includes(permissionId),
    );

    let kind: 'validated' | 'reentry' | 'supervisor' = 'validated';
    const item = log.itemName.toLowerCase();
    if (
      item.includes('re-entry') ||
      item.includes('reentry') ||
      item.includes('authorize_reentry')
    ) {
      kind = 'reentry';
    } else if (log.outcome === 'already_used') {
      kind = isSupervisor ? 'supervisor' : 'reentry';
    } else if (log.outcome === 'supervisor_resolved' || isSupervisor) {
      kind = log.outcome === 'supervisor_resolved' ? 'supervisor' : kind;
      if (item.includes('authorize_reentry')) {
        kind = 'reentry';
      } else if (isSupervisor && log.outcome !== 'valid') {
        kind = 'supervisor';
      }
    }

    return {
      kind,
      time_label: formatTimeLabel(log.scannedAt, countryCode),
      detail: formatValidatorDetail(log.staffMember),
      occurred_at: log.scannedAt.toISOString(),
    };
  });

  const auditEvents = auditLogs
    .filter((log) =>
      ['accept_invitation', 'cancel_invitation', 'reject_invitation'].includes(log.action),
    )
    .map((log) => ({
      kind: 'supervisor' as const,
      time_label: formatTimeLabel(log.createdAt, countryCode),
      detail: log.action.replace(/_/g, ' '),
      occurred_at: log.createdAt.toISOString(),
    }));

  const events = [...scanEvents, ...auditEvents].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );

  if (options?.previewLimit) {
    return events.slice(-options.previewLimit);
  }

  return events;
}

async function resolveRecentEvents(
  invitationId: string,
  manualEntryId: string,
  countryCode: string,
) {
  return resolveEntryEvents(invitationId, manualEntryId, countryCode, {
    previewLimit: 5,
  });
}

function formatGuestPhone(invitation: TicketWithInvitation['invitation']) {
  return invitation.recipientPhone?.trim() || null;
}

function formatGuestEmail(recipient: TicketWithInvitation['invitation']['recipient']) {
  return recipient?.email?.trim() || null;
}

function formatInvitationPurchaseId(
  invitationId: string,
  order: OrderContext | null,
) {
  const orderRef = formatPurchaseId(order);
  if (orderRef) {
    return orderRef;
  }

  return `INV-${invitationId.slice(-6).toUpperCase()}`;
}

function formatTicketTypeLabel(invitation: TicketWithInvitation['invitation'], vipTags: string[]) {
  if (vipTags.length >= 2) {
    return vipTags.join(' · ');
  }

  if (invitation.assignedSlot.trim()) {
    return invitation.assignedSlot;
  }

  return invitation.tier === 'vip' ? 'VIP' : 'General';
}

function formatPurchaseStatus(order: OrderContext | null) {
  if (!order) {
    return 'invitation_only';
  }

  return order.status;
}

async function resolveAccessPoint(manualEntryId: string) {
  const latestScan = await prisma.staffScanLog.findFirst({
    where: {
      entryId: manualEntryId,
      scanType: 'entry',
      outcome: { in: ['valid', 'supervisor_resolved'] },
    },
    orderBy: { scannedAt: 'desc' },
    include: {
      staffMember: {
        include: { zone: true },
      },
    },
  });

  return latestScan?.staffMember.zone?.label ?? null;
}

async function formatEntrySearchDetail(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const order = await resolveOrderContext(invitation.id);
  const vipTags = await resolveVipTags(invitation, order);
  const vipTableLabel =
    (await resolveVipTableLabel(order)) ??
    (invitation.tier === 'vip' && invitation.assignedSlot.trim()
      ? invitation.assignedSlot
      : null);
  const associatedEntries = await resolveAssociatedEntries(order);
  const validatorLabel = ticket.validatedAt
    ? await resolveValidatorLabel(ticket.manualEntryId)
    : null;
  const accessPoint = await resolveAccessPoint(ticket.manualEntryId);
  const recentEvents = await resolveRecentEvents(
    invitation.id,
    ticket.manualEntryId,
    invitation.event.countryCode,
  );

  return {
    invitation_id: invitation.id,
    ticket_id: ticket.id,
    order_id: order?.id ?? null,
    guest_name: guestName,
    guest_email: formatGuestEmail(invitation.recipient),
    guest_phone: formatGuestPhone(invitation),
    vip_tags: vipTags,
    qr_id: ticket.manualEntryId,
    qr_payload: ticket.qrPayload,
    purchase_id: formatInvitationPurchaseId(invitation.id, order),
    purchase_status: formatPurchaseStatus(order),
    ticket_type_label: formatTicketTypeLabel(invitation, vipTags),
    access_point: accessPoint,
    status: resolveEntryStatus(ticket),
    entry_time_label: ticket.validatedAt
      ? formatTimeLabel(ticket.validatedAt, invitation.event.countryCode)
      : null,
    validator_label: validatorLabel,
    vip_table_label: vipTableLabel,
    associated_entries_label: associatedEntries.label,
    associated_entries_used: associatedEntries.used,
    associated_entries_total: associatedEntries.total,
    is_vip: invitation.tier === 'vip',
    event_id: invitation.event.id,
    event_title: invitation.event.title,
    recent_events: recentEvents,
  };
}

export function formatEntrySearchSummary(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';

  return {
    invitation_id: invitation.id,
    ticket_id: ticket.id,
    order_id: null,
    guest_name: guestName,
    guest_email: formatGuestEmail(invitation.recipient),
    guest_phone: formatGuestPhone(invitation),
    vip_tags: buildVipTags(invitation),
    qr_id: ticket.manualEntryId,
    qr_payload: ticket.qrPayload,
    purchase_id: `INV-${invitation.id.slice(-6).toUpperCase()}`,
    purchase_status: null,
    ticket_type_label:
      invitation.assignedSlot.trim() || (invitation.tier === 'vip' ? 'VIP' : 'General'),
    access_point: null,
    status: resolveEntryStatus(ticket),
    entry_time_label: ticket.validatedAt
      ? formatTimeLabel(ticket.validatedAt, invitation.event.countryCode)
      : null,
    validator_label: null,
    vip_table_label: null,
    associated_entries_label: null,
    associated_entries_used: null,
    associated_entries_total: null,
    is_vip: invitation.tier === 'vip',
    event_id: invitation.event.id,
    event_title: invitation.event.title,
    recent_events: [],
  };
}

export function formatEntrySearchSummaries(tickets: TicketWithInvitation[]) {
  const results = tickets.map((ticket) => formatEntrySearchSummary(ticket));
  return {
    results,
    total: results.length,
  };
}

export async function formatEntrySearchDetailResponse(ticket: TicketWithInvitation) {
  return formatEntrySearchDetail(ticket);
}

export async function formatEntryHistoryResponse(ticket: TicketWithInvitation) {
  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const events = await resolveEntryEvents(
    invitation.id,
    ticket.manualEntryId,
    invitation.event.countryCode,
  );

  return {
    ticket_id: ticket.id,
    invitation_id: invitation.id,
    guest_name: guestName,
    event_title: invitation.event.title,
    qr_id: ticket.manualEntryId,
    events,
    total: events.length,
  };
}

/** Full formatting for every result — use only for debugging or batch exports. */
export async function formatEntrySearchResults(tickets: TicketWithInvitation[]) {
  const results = await Promise.all(tickets.map((ticket) => formatEntrySearchDetail(ticket)));
  return {
    results,
    total: results.length,
  };
}

export { searchSupervisorEntries };
