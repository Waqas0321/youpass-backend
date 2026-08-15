import type { VenueZoneKind } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { getEventCurrencyMeta } from '../../common/services/country-config.service.js';
import { buildVenueTableAdminRefFilter } from '../../common/utils/mongo-id.js';
import { bootstrapVenueLayoutByEventId } from '../vip-venue/bootstrap-venue-layout.service.js';
import type {
  AdminVipTableActionInput,
  AdminVipTableEditInput,
  AdminVipTableMoveInput,
} from './admin-event-vip-tables.validators.js';

const VIP_ZONE_KINDS: VenueZoneKind[] = ['vip_table_zone', 'vip_premium_zone'];

type BuyerInfo = {
  user_id: string | null;
  name: string;
  phone: string;
  profile_photo_url: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function mapAdminStatus(status: string) {
  if (status === 'sold') return 'paid';
  if (status === 'locked') return 'blocked';
  return status;
}

function mapGuestEntryStatus(input: {
  slotStatus: string;
  invitationStatus?: string | null;
  validatedAt?: Date | null;
}) {
  if (input.validatedAt || input.invitationStatus === 'validated') {
    return 'confirmed';
  }
  if (
    input.invitationStatus === 'rejected' ||
    input.invitationStatus === 'canceled' ||
    input.invitationStatus === 'expired' ||
    input.invitationStatus === 'failed'
  ) {
    return 'rejected';
  }
  if (input.slotStatus === 'claimed' || input.invitationStatus === 'accepted') {
    return 'confirmed';
  }
  if (input.slotStatus === 'assigned') {
    return 'sent';
  }
  if (
    input.slotStatus === 'available' ||
    input.slotStatus === 'empty' ||
    input.slotStatus === 'pending'
  ) {
    return 'pending';
  }
  return 'pending';
}

function buildGuestRowsForTable(
  table: { capacity: number },
  order: {
    buyer: { fullName: string; phone: string } | null;
    slots: Array<{
      id: string;
      slotNumber: number;
      status: string;
      guestName: string | null;
      guestPhone: string | null;
      invitationId: string | null;
    }>;
  } | null,
  invitationById: Map<
    string,
    { status: string; ticket: { validatedAt: Date | null } | null }
  >,
) {
  const mappedByNumber = new Map<number, {
    slot_id: string;
    slot_number: number;
    name: string;
    phone: string;
    entry_status: 'confirmed' | 'sent' | 'rejected' | 'pending';
    slot_status: string;
  }>();

  for (const slot of order?.slots ?? []) {
    const invitation = slot.invitationId ? invitationById.get(slot.invitationId) : null;
    const guestName =
      slot.guestName ??
      (slot.status === 'owner' ? order?.buyer?.fullName ?? null : null) ??
      '—';
    const guestPhone =
      slot.guestPhone ?? (slot.status === 'owner' ? order?.buyer?.phone ?? null : null) ?? '—';

    mappedByNumber.set(slot.slotNumber, {
      slot_id: slot.id,
      slot_number: slot.slotNumber,
      name: guestName,
      phone: guestPhone,
      entry_status: mapGuestEntryStatus({
        slotStatus: slot.status,
        invitationStatus: invitation?.status ?? null,
        validatedAt: invitation?.ticket?.validatedAt ?? null,
      }),
      slot_status: slot.status,
    });
  }

  const guests = [];
  for (let slotNumber = 1; slotNumber <= table.capacity; slotNumber += 1) {
    const existing = mappedByNumber.get(slotNumber);
    if (existing) {
      guests.push(existing);
      continue;
    }

    guests.push({
      slot_id: `empty-${slotNumber}`,
      slot_number: slotNumber,
      name: '—',
      phone: '—',
      entry_status: 'pending' as const,
      slot_status: 'empty',
    });
  }

  return guests;
}

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  }
  return event;
}

async function resolveVipTable(eventId: string, tableRef: string) {
  const table = await prisma.venueTable.findFirst({
    where: {
      eventId,
      ...buildVenueTableAdminRefFilter(tableRef),
      zone: { kind: { in: VIP_ZONE_KINDS } },
    },
    include: {
      zone: true,
      soldToUser: {
        select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
      },
      lockedByUser: {
        select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
      },
    },
  });

  if (!table) {
    throw new AppError(404, 'VENUE_TABLE_NOT_FOUND', 'VIP table not found');
  }

  return table;
}

function formatBuyer(user: {
  id: string;
  fullName: string;
  phone: string;
  profilePhotoUrl: string | null;
} | null | undefined): BuyerInfo | null {
  if (!user) {
    return null;
  }

  return {
    user_id: user.id,
    name: user.fullName,
    phone: user.phone,
    profile_photo_url: user.profilePhotoUrl,
  };
}

function resolveBuyerForTable(
  table: {
    id: string;
    status: string;
    soldToUser: Parameters<typeof formatBuyer>[0];
    lockedByUser: Parameters<typeof formatBuyer>[0];
  },
  orderBuyers: Map<string, BuyerInfo>,
) {
  if (table.status === 'sold') {
    return formatBuyer(table.soldToUser) ?? orderBuyers.get(table.id) ?? null;
  }

  if (table.status === 'reserved' || table.status === 'locked') {
    return formatBuyer(table.lockedByUser) ?? orderBuyers.get(table.id) ?? null;
  }

  return orderBuyers.get(table.id) ?? null;
}

function formatTableRow(
  table: {
    id: string;
    number: number;
    label: string;
    status: string;
    price: number;
    currency: string;
    capacity: number;
    zone: { id: string; name: string; color: string; externalId: string };
  },
  buyer: BuyerInfo | null,
  currency: string,
) {
  return {
    table_id: table.id,
    zone_id: table.zone.id,
    zone_external_id: table.zone.externalId,
    zone_name: table.zone.name,
    zone_color: table.zone.color,
    number: table.number,
    label: table.label,
    capacity: table.capacity,
    status: mapAdminStatus(table.status),
    backend_status: table.status,
    price: table.price,
    currency: table.currency || currency,
    buyer: buyer
      ? {
          user_id: buyer.user_id,
          name: buyer.name,
          phone: buyer.phone,
          avatar_initials: initials(buyer.name),
          avatar_url: buyer.profile_photo_url,
        }
      : null,
  };
}

export const adminEventVipTablesService = {
  async listTables(eventId: string) {
    const event = await assertEvent(eventId);
    const currencyMeta = getEventCurrencyMeta(event.countryCode);

    const layout = await prisma.eventVenueLayout.findUnique({
      where: { eventId },
      select: { id: true },
    });

    if (!layout) {
      return {
        event_id: eventId,
        currency: currencyMeta.currency,
        layout_configured: false,
        tables: [],
      };
    }

    const [tables, orders] = await Promise.all([
      prisma.venueTable.findMany({
        where: {
          eventId,
          zone: { kind: { in: VIP_ZONE_KINDS } },
        },
        include: {
          zone: true,
          soldToUser: {
            select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
          },
          lockedByUser: {
            select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
          },
        },
        orderBy: [{ zone: { displayOrder: 'asc' } }, { number: 'asc' }],
      }),
      prisma.ticketOrder.findMany({
        where: {
          eventId,
          status: 'paid',
          venueTableId: { not: null },
        },
        include: {
          buyer: {
            select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
          },
        },
      }),
    ]);

    const orderBuyers = new Map<string, BuyerInfo>();
    for (const order of orders) {
      if (!order.venueTableId || !order.buyer) {
        continue;
      }
      orderBuyers.set(order.venueTableId, formatBuyer(order.buyer)!);
    }

    const rows = tables.map((table) => {
      const buyer = resolveBuyerForTable(table, orderBuyers);
      return formatTableRow(table, buyer, currencyMeta.currency);
    });

    return {
      event_id: eventId,
      currency: currencyMeta.currency,
      layout_configured: true,
      tables: rows,
    };
  },

  async ensureLayout(eventId: string) {
    await assertEvent(eventId);
    await bootstrapVenueLayoutByEventId(eventId);
    return this.listTables(eventId);
  },

  async listGuests(eventId: string, tableRef: string) {
    const table = await resolveVipTable(eventId, tableRef);

    const order = await prisma.ticketOrder.findFirst({
      where: {
        eventId,
        venueTableId: table.id,
        status: 'paid',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { id: true, fullName: true, phone: true, profilePhotoUrl: true },
        },
        slots: {
          orderBy: { slotNumber: 'asc' },
        },
      },
    });

    const invitationIds = (order?.slots ?? [])
      .map((slot) => slot.invitationId)
      .filter((id): id is string => Boolean(id));

    const invitations =
      invitationIds.length > 0
        ? await prisma.invitation.findMany({
            where: { id: { in: invitationIds } },
            include: {
              ticket: {
                select: { validatedAt: true },
              },
            },
          })
        : [];

    const invitationById = new Map(invitations.map((invitation) => [invitation.id, invitation]));

    const guests = buildGuestRowsForTable(
      table,
      order
        ? {
            buyer: order.buyer,
            slots: order.slots,
          }
        : null,
      invitationById,
    );

    const buyer =
      (order?.buyer ? formatBuyer(order.buyer) : null) ??
      formatBuyer(table.soldToUser) ??
      formatBuyer(table.lockedByUser);

    return {
      table_id: table.id,
      zone_name: table.zone.name,
      number: table.number,
      capacity: table.capacity,
      status: mapAdminStatus(table.status),
      buyer: buyer
        ? {
            name: buyer.name,
            phone: buyer.phone,
            avatar_initials: initials(buyer.name),
            avatar_url: buyer.profile_photo_url,
          }
        : null,
      guests,
    };
  },

  async applyAction(eventId: string, tableRef: string, input: AdminVipTableActionInput) {
    const table = await resolveVipTable(eventId, tableRef);

    if (input.action === 'reserve') {
      if (table.status !== 'available') {
        throw new AppError(409, 'TABLE_NOT_AVAILABLE', 'Only available tables can be reserved');
      }
      await prisma.venueTable.update({
        where: { id: table.id },
        data: { status: 'reserved', lockedByUserId: null, lockedUntil: null },
      });
    }

    if (input.action === 'block') {
      if (table.status === 'sold') {
        throw new AppError(409, 'TABLE_NOT_AVAILABLE', 'Sold tables cannot be blocked');
      }
      await prisma.venueTable.update({
        where: { id: table.id },
        data: { status: 'locked', lockedByUserId: null, lockedUntil: null },
      });
      await prisma.tableLock.updateMany({
        where: { tableId: table.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
    }

    if (input.action === 'unblock') {
      if (table.status !== 'locked') {
        throw new AppError(409, 'INVALID_TABLE_STATE', 'Only blocked tables can be unblocked');
      }
      await prisma.venueTable.update({
        where: { id: table.id },
        data: { status: 'available', lockedByUserId: null, lockedUntil: null },
      });
    }

    if (input.action === 'release') {
      if (table.status === 'sold') {
        throw new AppError(409, 'TABLE_NOT_RELEASABLE', 'Paid tables cannot be released from admin');
      }
      if (table.status !== 'reserved' && table.status !== 'locked') {
        throw new AppError(409, 'TABLE_NOT_RELEASABLE', 'Only reserved or blocked tables can be released');
      }
      await prisma.$transaction([
        prisma.tableLock.updateMany({
          where: { tableId: table.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        }),
        prisma.venueTable.update({
          where: { id: table.id },
          data: { status: 'available', lockedByUserId: null, lockedUntil: null },
        }),
      ]);
    }

    return this.listTables(eventId);
  },

  async moveTable(eventId: string, tableRef: string, input: AdminVipTableMoveInput) {
    const table = await resolveVipTable(eventId, tableRef);

    if (table.status === 'sold') {
      throw new AppError(409, 'TABLE_NOT_MOVABLE', 'Sold tables cannot be moved');
    }

    const targetZone = await prisma.venueZone.findFirst({
      where: {
        id: input.zone_id,
        layout: { eventId },
        kind: { in: VIP_ZONE_KINDS },
      },
    });

    if (!targetZone) {
      throw new AppError(404, 'VENUE_ZONE_NOT_FOUND', 'Target VIP zone not found');
    }

    if (targetZone.id === table.zoneId) {
      return this.listTables(eventId);
    }

    await prisma.venueTable.update({
      where: { id: table.id },
      data: { zoneId: targetZone.id },
    });

    return this.listTables(eventId);
  },

  async editTable(eventId: string, tableRef: string, input: AdminVipTableEditInput) {
    const table = await resolveVipTable(eventId, tableRef);

    if (table.status === 'sold' && (input.price != null || input.capacity != null)) {
      throw new AppError(409, 'TABLE_NOT_EDITABLE', 'Price and capacity cannot change on sold tables');
    }

    await prisma.venueTable.update({
      where: { id: table.id },
      data: {
        ...(input.number != null ? { number: input.number } : {}),
        ...(input.label != null ? { label: input.label } : {}),
        ...(input.price != null ? { price: input.price } : {}),
        ...(input.capacity != null ? { capacity: input.capacity } : {}),
        ...(input.status != null ? { status: input.status } : {}),
      },
    });

    return this.listTables(eventId);
  },

  async cancelGuest(eventId: string, tableRef: string, slotId: string) {
    const table = await resolveVipTable(eventId, tableRef);

    const slot = await prisma.ticketSlot.findFirst({
      where: {
        id: slotId,
        order: {
          eventId,
          venueTableId: table.id,
          status: 'paid',
        },
      },
    });

    if (!slot) {
      throw new AppError(404, 'TICKET_SLOT_NOT_FOUND', 'Guest slot not found for this table');
    }

    if (slot.status === 'owner') {
      throw new AppError(409, 'TICKET_SLOT_NOT_CANCELLABLE', 'The table host entry cannot be cancelled');
    }

    await prisma.$transaction(async (tx) => {
      if (slot.invitationId) {
        await tx.invitation.update({
          where: { id: slot.invitationId },
          data: { status: 'canceled', respondedAt: new Date() },
        });
      }

      await tx.ticketSlot.update({
        where: { id: slot.id },
        data: {
          status: 'available',
          guestName: null,
          guestPhone: null,
          guestCountryCode: null,
          invitationId: null,
        },
      });
    });

    return this.listGuests(eventId, tableRef);
  },
};
