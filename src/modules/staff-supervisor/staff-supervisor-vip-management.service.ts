import crypto from 'node:crypto';

import type { InvitationTier } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { parseAndValidatePhone } from '../../common/utils/phone.js';
import { verifyOtp } from '../../common/utils/crypto.js';
import { hasSupervisorAccess } from '../staff/staff-permissions.constants.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import { invitationConfigService } from '../../common/services/invitation-config.service.js';
import { buildClaimUrl } from '../messaging/invitation-delivery.service.js';
import { defaultCancellationDeadline } from '../tickets/tickets.utils.js';
import {
  formatPurchaseId,
  formatTimeLabel,
} from './staff-supervisor-entry-search.service.js';
import type { StaffSupervisorApplyVipTableActionInput } from './staff-supervisor.validators.js';

const VIP_ACTION_PREFIX = 'supervisor_vip_';

const orderInclude = {
  buyer: { select: { id: true, fullName: true, countryCode: true } },
  event: { select: { id: true, title: true, countryCode: true, startsAt: true } },
  slots: { orderBy: { slotNumber: 'asc' as const } },
} as const;

type InvitationSummary = {
  assignedSlot: string;
  tier: InvitationTier;
  recipientName: string | null;
  recipient: { fullName: string } | null;
  ticket: { validatedAt: Date | null } | null;
};

async function assertSupervisorPin(staffMemberId: string, pin: string) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    select: { permissionIds: true, supervisorPinHash: true },
  });

  if (!member) {
    throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found');
  }

  if (!hasSupervisorAccess(member.permissionIds)) {
    throw new AppError(
      403,
      'SUPERVISOR_ACCESS_DENIED',
      'This staff account is not authorized for supervisor mode',
    );
  }

  if (!member.supervisorPinHash) {
    throw new AppError(
      403,
      'SUPERVISOR_PIN_NOT_CONFIGURED',
      'Supervisor PIN has not been configured by an administrator',
    );
  }

  const isValid = await verifyOtp(pin, member.supervisorPinHash);
  if (!isValid) {
    throw new AppError(401, 'SUPERVISOR_PIN_INVALID', 'Incorrect supervisor PIN');
  }
}

async function getSystemProducerId() {
  const producer =
    (await prisma.producer.findFirst({ where: { name: 'YouPass' } })) ??
    (await prisma.producer.create({ data: { name: 'YouPass' } }));
  return producer.id;
}

async function resolveTableMeta(order: {
  venueTableId: string | null;
  venueZoneId: string | null;
}) {
  if (!order.venueTableId) {
    return { tableName: 'VIP TABLE', accessLabel: 'VIP' };
  }

  try {
    const table = await prisma.venueTable.findUnique({
      where: { id: order.venueTableId },
      include: { zone: { select: { name: true } } },
    });

    if (!table) {
      return { tableName: 'VIP TABLE', accessLabel: 'VIP' };
    }

    const tableName = table.label.startsWith('Mesa')
      ? table.label
      : `MESA VIP ${table.label}`;
    const accessLabel = table.zone?.name?.trim() || 'VIP';

    return { tableName, accessLabel };
  } catch {
    return { tableName: 'VIP TABLE', accessLabel: 'VIP' };
  }
}

async function loadInvitationsForSlots(invitationIds: string[]) {
  if (invitationIds.length === 0) {
    return new Map<string, InvitationSummary>();
  }

  try {
    const invitations = await prisma.invitation.findMany({
      where: { id: { in: invitationIds } },
      include: {
        ticket: { select: { validatedAt: true } },
        recipient: { select: { fullName: true } },
      },
    });

    return new Map(invitations.map((invitation) => [invitation.id, invitation]));
  } catch {
    return new Map<string, InvitationSummary>();
  }
}

async function loadInvitationById(id: string) {
  return prisma.invitation.findUnique({
    where: { id },
    include: {
      ticket: { select: { validatedAt: true, unlockAt: true } },
      recipient: { select: { fullName: true } },
    },
  });
}

function mapHistoryType(action: string) {
  if (action.includes('extra_guest')) return 'extra_guest' as const;
  if (action.includes('release')) return 'qr_released' as const;
  if (action.includes('change_access') || action.includes('move_guest')) {
    return 'table_modified' as const;
  }
  return 'table_modified' as const;
}

async function loadAccessOptionsForEvent(eventId: string, currentAccessLabel: string) {
  try {
    const layout = await prisma.eventVenueLayout.findUnique({
      where: { eventId },
      include: {
        zones: {
          where: {
            kind: { in: ['vip_table_zone', 'vip_premium_zone'] },
          },
          orderBy: { displayOrder: 'asc' },
          select: { name: true },
        },
      },
    });

    const options: Array<{ label: string; tier: InvitationTier }> = [];
    const seen = new Set<string>();

    const pushOption = (label: string, tier: InvitationTier) => {
      const normalized = label.trim();
      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      options.push({ label: normalized, tier });
    };

    if (currentAccessLabel.trim()) {
      pushOption(currentAccessLabel, 'vip');
    }

    for (const zone of layout?.zones ?? []) {
      pushOption(zone.name, 'vip');
    }

    pushOption('VIP Guest', 'vip');
    pushOption('General', 'general');

    return options;
  } catch {
    return [
      ...(currentAccessLabel.trim()
        ? [{ label: currentAccessLabel.trim(), tier: 'vip' as const }]
        : []),
      { label: 'VIP Guest', tier: 'vip' as const },
      { label: 'General', tier: 'general' as const },
    ];
  }
}

function buildAvailableSlotRows(order: Awaited<ReturnType<typeof loadVipOrder>>) {
  return order.slots
    .filter((slot) => slot.status === 'available' && !slot.invitationId)
    .map((slot) => ({
      slot_id: slot.id,
      slot_number: slot.slotNumber,
      label: `Seat ${slot.slotNumber}`,
    }));
}

async function buildGuestRows(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  invitationMap: Map<string, InvitationSummary>,
  tableAccessLabel: string,
) {
  const countryCode = order.event.countryCode;
  const guests: Array<{
    slot_id: string;
    name: string;
    status: 'entered' | 'pending';
    entry_time_label: string | null;
    access_label: string;
    is_owner: boolean;
    can_move: boolean;
    can_release: boolean;
  }> = [];

  for (const slot of order.slots) {
    if (slot.status === 'available' && !slot.guestName && !slot.invitationId) {
      continue;
    }

    const invitation = slot.invitationId ? invitationMap.get(slot.invitationId) : null;
    const name =
      slot.guestName?.trim() ||
      invitation?.recipient?.fullName?.trim() ||
      invitation?.recipientName?.trim() ||
      (slot.status === 'owner' ? order.buyer.fullName : 'Guest');

    const entered = Boolean(invitation?.ticket?.validatedAt);
    const isOwner = slot.status === 'owner';
    guests.push({
      slot_id: slot.id,
      name,
      status: entered ? 'entered' : 'pending',
      entry_time_label: entered && invitation?.ticket?.validatedAt
        ? formatTimeLabel(invitation.ticket.validatedAt, countryCode)
        : null,
      access_label: invitation?.assignedSlot?.trim() || tableAccessLabel,
      is_owner: isOwner,
      can_move: Boolean(slot.invitationId) && !isOwner,
      can_release: Boolean(slot.invitationId),
    });
  }

  return guests;
}

async function buildHistoryRows(
  invitationIds: string[],
  countryCode: string,
) {
  if (invitationIds.length === 0) {
    return [];
  }

  const audits = await prisma.invitationAuditLog.findMany({
    where: {
      invitationId: { in: invitationIds },
      action: { startsWith: VIP_ACTION_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return audits.map((audit) => {
    const metadata = (audit.metadata ?? {}) as Record<string, unknown>;
    return {
      type: mapHistoryType(audit.action),
      supervisor_name: String(metadata.staff_name ?? metadata.supervisor_name ?? 'Supervisor'),
      time_label: formatTimeLabel(audit.createdAt, countryCode),
    };
  });
}

async function loadVipOrder(orderId: string) {
  const order = await prisma.ticketOrder.findFirst({
    where: {
      id: orderId,
      status: 'paid',
      OR: [{ venueTableId: { not: null } }, { tier: 'vip', type: 'vip_table' }],
    },
    include: orderInclude,
  });

  if (!order) {
    throw new AppError(404, 'VIP_TABLE_NOT_FOUND', 'VIP table order not found');
  }

  return order;
}

async function formatVipTableContext(orderId: string) {
  const order = await loadVipOrder(orderId);
  const { tableName, accessLabel } = await resolveTableMeta(order);
  const invitationIds = order.slots
    .map((slot) => slot.invitationId)
    .filter((id): id is string => Boolean(id));

  const invitationMap = await loadInvitationsForSlots(invitationIds);
  const guests = await buildGuestRows(order, invitationMap, accessLabel);
  const enteredCount = guests.filter((guest) => guest.status === 'entered').length;
  const pendingCount = guests.filter((guest) => guest.status === 'pending').length;
  const history = await buildHistoryRows(invitationIds, order.event.countryCode);
  const availableSlots = buildAvailableSlotRows(order);
  const accessOptions = await loadAccessOptionsForEvent(order.eventId, accessLabel);

  return {
    order_id: order.id,
    table_name: tableName,
    access_label: accessLabel,
    event_name: order.event.title,
    capacity: order.quantity,
    entered_count: enteredCount,
    pending_count: pendingCount,
    purchase_responsible: order.buyer.fullName,
    purchase_id: formatPurchaseId(order) ?? `ORD-${order.id.slice(-6).toUpperCase()}`,
    is_active: true,
    guests,
    available_slots: availableSlots,
    access_options: accessOptions,
    history,
  };
}

async function searchVipTableOrders(term: string) {
  const normalized = term.trim();
  if (normalized.length < 2) {
    return { results: [] as Awaited<ReturnType<typeof formatVipTableContext>>[] };
  }

  const tableMatches = await prisma.venueTable.findMany({
    where: { label: { contains: normalized, mode: 'insensitive' } },
    select: { id: true },
    take: 10,
  });

  const orders = await prisma.ticketOrder.findMany({
    where: {
      status: 'paid',
      OR: [
        { venueTableId: { in: tableMatches.map((table) => table.id) } },
        { paymentReference: { contains: normalized, mode: 'insensitive' } },
        {
          buyer: {
            is: {
              fullName: { contains: normalized, mode: 'insensitive' },
            },
          },
        },
      ],
      AND: {
        OR: [{ venueTableId: { not: null } }, { tier: 'vip', type: 'vip_table' }],
      },
    },
    include: orderInclude,
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  const contexts = (
    await Promise.all(
      orders.map(async (order) => {
        try {
          return await formatVipTableContext(order.id);
        } catch {
          return null;
        }
      }),
    )
  ).filter((context): context is Awaited<ReturnType<typeof formatVipTableContext>> =>
    Boolean(context),
  );
  return { results: contexts };
}

async function logVipAction(
  staffMemberId: string,
  staffName: string,
  orderId: string,
  invitationId: string | null,
  action: StaffSupervisorApplyVipTableActionInput['action'],
  notes: string,
  metadata: Record<string, unknown> = {},
) {
  if (!invitationId) {
    return;
  }

  await invitationAuditService.log({
    invitationId,
    actorType: 'system',
    action: `${VIP_ACTION_PREFIX}${action}`,
    result: 'success',
    metadata: {
      staff_member_id: staffMemberId,
      staff_name: staffName,
      order_id: orderId,
      notes: notes.trim(),
      ...metadata,
    },
  });
}

function resolveSlotById(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  slotId: string | undefined,
) {
  const normalized = slotId?.trim();
  if (!normalized) {
    throw new AppError(422, 'VIP_SLOT_REQUIRED', 'Select a guest before continuing');
  }

  const slot = order.slots.find((row) => row.id === normalized);
  if (!slot) {
    throw new AppError(404, 'VIP_SLOT_NOT_FOUND', 'Selected guest slot was not found');
  }

  return slot;
}

async function authorizeExtraGuest(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  staffMemberId: string,
  staffName: string,
  input: StaffSupervisorApplyVipTableActionInput,
) {
  const guestName = input.guest_name?.trim();
  const guestPhone = input.guest_phone?.trim();

  if (!guestName || !guestPhone) {
    throw new AppError(422, 'VIP_GUEST_REQUIRED', 'Guest name and phone are required');
  }

  const slot = order.slots.find((row) => row.status === 'available');
  if (!slot) {
    throw new AppError(409, 'VIP_NO_AVAILABLE_SLOTS', 'No available slots on this VIP table');
  }

  const { e164, countryCode } = await parseAndValidatePhone(
    guestPhone,
    input.guest_country_code?.toUpperCase() ?? order.event.countryCode,
  );

  const claimToken = crypto.randomBytes(16).toString('hex');
  const sentAt = new Date();
  const expiresAt = await invitationConfigService.computeExpiresAt(sentAt);
  const producerId = await getSystemProducerId();

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.invitation.create({
      data: {
        eventId: order.eventId,
        producerId,
        recipientPhone: e164,
        recipientName: guestName,
        inviterUserId: order.buyerUserId,
        source: 'guest',
        claimToken,
        type: 'free',
        tier: order.tier,
        status: 'sent',
        assignedSlot: order.venueTableId ? `VIP Guest` : `Entrada ${slot.slotNumber}`,
        entryValue: order.unitPrice ?? 0,
        amountToPay: 0,
        cancellationDeadline: defaultCancellationDeadline(order.event.startsAt),
        sentAt,
        expiresAt,
      },
    });

    await tx.ticketSlot.update({
      where: { id: slot.id },
      data: {
        status: 'assigned',
        guestName,
        guestPhone: e164,
        guestCountryCode: countryCode,
        invitationId: created.id,
      },
    });

    return created;
  });

  await logVipAction(staffMemberId, staffName, order.id, invitation.id, input.action, input.notes, {
    guest_name: guestName,
    guest_phone: e164,
    slot_id: slot.id,
    claim_url: buildClaimUrl(claimToken),
  });

  return formatVipTableContext(order.id);
}

async function releaseInvitation(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  staffMemberId: string,
  staffName: string,
  input: StaffSupervisorApplyVipTableActionInput,
) {
  const slot = resolveSlotById(order, input.slot_id);

  if (!slot.invitationId) {
    throw new AppError(404, 'VIP_SLOT_NOT_FOUND', 'No invitation found to release');
  }

  const ticket = await prisma.invitationTicket.findFirst({
    where: { invitationId: slot.invitationId },
  });

  if (ticket) {
    await prisma.invitationTicket.update({
      where: { id: ticket.id },
      data: { unlockAt: new Date() },
    });
  }

  await logVipAction(
    staffMemberId,
    staffName,
    order.id,
    slot.invitationId,
    input.action,
    input.notes,
    {
      slot_id: slot.id,
      guest_name: slot.guestName,
      qr_unlocked: Boolean(ticket),
    },
  );

  return formatVipTableContext(order.id);
}

async function moveGuest(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  staffMemberId: string,
  staffName: string,
  input: StaffSupervisorApplyVipTableActionInput,
) {
  const sourceSlot = resolveSlotById(order, input.slot_id);
  const targetSlotId = input.target_slot_id?.trim();

  if (!targetSlotId) {
    throw new AppError(422, 'VIP_TARGET_SLOT_REQUIRED', 'Select a destination seat');
  }

  if (!sourceSlot.invitationId) {
    throw new AppError(404, 'VIP_SLOT_NOT_FOUND', 'Selected guest has no invitation to move');
  }

  if (sourceSlot.status === 'owner') {
    throw new AppError(409, 'VIP_OWNER_SLOT_IMMUTABLE', 'The table owner seat cannot be moved');
  }

  if (sourceSlot.id === targetSlotId) {
    throw new AppError(422, 'VIP_INVALID_SLOT_MOVE', 'Source and destination seats must differ');
  }

  const targetSlot = order.slots.find((row) => row.id === targetSlotId);
  if (!targetSlot) {
    throw new AppError(404, 'VIP_TARGET_SLOT_NOT_FOUND', 'Destination seat was not found');
  }

  if (targetSlot.status !== 'available' || targetSlot.invitationId) {
    throw new AppError(409, 'VIP_TARGET_SLOT_UNAVAILABLE', 'Destination seat is not available');
  }

  const nextAssignedSlot = `Entrada ${targetSlot.slotNumber}`;

  await prisma.$transaction(async (tx) => {
    await tx.ticketSlot.update({
      where: { id: targetSlot.id },
      data: {
        status: sourceSlot.status === 'claimed' ? 'claimed' : 'assigned',
        guestName: sourceSlot.guestName,
        guestPhone: sourceSlot.guestPhone,
        guestCountryCode: sourceSlot.guestCountryCode,
        invitationId: sourceSlot.invitationId,
      },
    });

    await tx.ticketSlot.update({
      where: { id: sourceSlot.id },
      data: {
        status: 'available',
        guestName: null,
        guestPhone: null,
        guestCountryCode: null,
        invitationId: null,
      },
    });

    await tx.invitation.update({
      where: { id: sourceSlot.invitationId! },
      data: { assignedSlot: nextAssignedSlot },
    });
  });

  await logVipAction(
    staffMemberId,
    staffName,
    order.id,
    sourceSlot.invitationId,
    input.action,
    input.notes,
    {
      from_slot_id: sourceSlot.id,
      to_slot_id: targetSlot.id,
      guest_name: sourceSlot.guestName,
      assigned_slot: nextAssignedSlot,
    },
  );

  return formatVipTableContext(order.id);
}

async function changeGuestAccess(
  order: Awaited<ReturnType<typeof loadVipOrder>>,
  staffMemberId: string,
  staffName: string,
  input: StaffSupervisorApplyVipTableActionInput,
) {
  const slot = resolveSlotById(order, input.slot_id);
  const accessLabel = input.access_label?.trim();

  if (!accessLabel) {
    throw new AppError(422, 'VIP_ACCESS_LABEL_REQUIRED', 'Select a VIP access level');
  }

  if (!slot.invitationId) {
    throw new AppError(404, 'VIP_SLOT_NOT_FOUND', 'Selected guest has no invitation to update');
  }

  const invitation = await loadInvitationById(slot.invitationId);
  if (!invitation) {
    throw new AppError(404, 'VIP_INVITATION_NOT_FOUND', 'Guest invitation was not found');
  }

  const { accessLabel: tableAccessLabel } = await resolveTableMeta(order);
  const accessOptions = await loadAccessOptionsForEvent(order.eventId, tableAccessLabel);
  const matchedOption = accessOptions.find(
    (option) => option.label.toLowerCase() === accessLabel.toLowerCase(),
  );
  const nextTier = matchedOption?.tier ?? (accessLabel.toLowerCase() === 'general' ? 'general' : 'vip');

  await prisma.invitation.update({
    where: { id: slot.invitationId },
    data: {
      assignedSlot: matchedOption?.label ?? accessLabel,
      tier: nextTier,
    },
  });

  await logVipAction(
    staffMemberId,
    staffName,
    order.id,
    slot.invitationId,
    input.action,
    input.notes,
    {
      slot_id: slot.id,
      guest_name: slot.guestName,
      previous_access: invitation.assignedSlot,
      new_access: matchedOption?.label ?? accessLabel,
      previous_tier: invitation.tier,
      new_tier: nextTier,
    },
  );

  return formatVipTableContext(order.id);
}

export const staffSupervisorVipManagementService = {
  searchVipTables(query: string) {
    return searchVipTableOrders(query);
  },

  getVipTableContext(orderId: string) {
    return formatVipTableContext(orderId);
  },

  async applyVipTableAction(
    orderId: string,
    staffMemberId: string,
    staffName: string,
    input: StaffSupervisorApplyVipTableActionInput,
  ) {
    await assertSupervisorPin(staffMemberId, input.pin);
    const order = await loadVipOrder(orderId);

    const context = await (async () => {
      switch (input.action) {
        case 'authorize_extra_guest':
          return authorizeExtraGuest(order, staffMemberId, staffName, input);
        case 'release_invitation':
          return releaseInvitation(order, staffMemberId, staffName, input);
        case 'move_guest':
          return moveGuest(order, staffMemberId, staffName, input);
        case 'change_access':
          return changeGuestAccess(order, staffMemberId, staffName, input);
        default:
          throw new AppError(400, 'INVALID_VIP_ACTION', 'Unsupported VIP action');
      }
    })();

    return {
      applied: true,
      action: input.action,
      order_id: orderId,
      context,
    };
  },
};
