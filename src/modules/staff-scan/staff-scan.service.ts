import type { StaffMember } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { invitationDoorValidationService } from '../invitations/invitation-door-validation.service.js';
import { findInvitationTicketByScanInput } from '../invitations/invitation-ticket-scan.utils.js';
import { resolveInvitationProductLabel } from '../invitations/invitation-product-type.utils.js';
import { eventDrinkRedemptionService, findDrinkRedemptionByScanInput } from '../event-drinks/event-drink-redemption.service.js';

type StaffScanResponse = {
  outcome: 'valid' | 'already_used';
  scan_type: 'entry' | 'product';
  guest_name: string;
  event_id: string;
  event_title: string;
  ticket_type?: string;
  product_name?: string;
  product_quantity?: number;
  entry_id: string;
  ticket_id?: string;
  transaction_id: string;
  access_level?: string;
  bar_name?: string;
  validated_at?: string;
  last_used_at?: string;
  qr_payload: string;
};

type StaffRecentScanType = 'entry' | 'product';

const PRODUCT_SCAN_PERMISSIONS = ['scan_products', 'bar_supervisor', 'general_admin'] as const;
const ENTRY_SCAN_PERMISSIONS = ['scan_tickets', 'tickets_supervisor', 'general_admin'] as const;

function activeEventWindow() {
  const now = Date.now();
  return {
    status: 'published' as const,
    startsAt: {
      gte: new Date(now - 24 * 60 * 60 * 1000),
      lte: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  };
}

function formatAccessLevel(tier: string): string {
  if (tier === 'vip') {
    return 'VIP 1';
  }
  return 'General';
}

function loadStaffContext(staffMember: StaffMember) {
  return prisma.staffMember.findUniqueOrThrow({
    where: { id: staffMember.id },
    include: { zone: true, role: true },
  });
}

function assertScanTypePermission(staffMember: StaffMember, scanType: StaffRecentScanType) {
  const granted = new Set(staffMember.permissionIds ?? []);
  const required =
    scanType === 'product' ? PRODUCT_SCAN_PERMISSIONS : ENTRY_SCAN_PERMISSIONS;

  if (!required.some((permissionId) => granted.has(permissionId))) {
    throw new AppError(
      403,
      'STAFF_PERMISSION_DENIED',
      'You do not have permission to perform this action',
    );
  }
}

async function logStaffScan(staffMemberId: string, response: StaffScanResponse) {
  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
      scanType: response.scan_type,
      outcome: response.outcome,
      guestName: response.guest_name,
      itemName: response.product_name ?? response.ticket_type ?? 'Scan',
      eventTitle: response.event_title,
      entryId: response.entry_id,
      transactionId: response.transaction_id,
      qrPayload: response.qr_payload,
      accessLevel: response.access_level,
      barName: response.bar_name,
      productQuantity: response.product_quantity,
      lastUsedAt: response.last_used_at ? new Date(response.last_used_at) : null,
    },
  });
}

async function finalizeScan(
  staffMember: StaffMember,
  response: StaffScanResponse,
): Promise<StaffScanResponse> {
  await logStaffScan(staffMember.id, response);
  return response;
}

async function buildEntryScanResponse(
  scanInput: string,
  alreadyValidated: boolean,
  validatedAt?: Date | null,
): Promise<StaffScanResponse> {
  const ticket = await findInvitationTicketByScanInput(scanInput);

  if (!ticket) {
    throw new AppError(404, 'QR_NOT_FOUND', 'QR code not recognised');
  }

  const invitation = ticket.invitation;
  const guestName = invitation.recipient?.fullName ?? invitation.recipientName ?? 'Guest';
  const ticketType = invitation.assignedSlot || resolveInvitationProductLabel(invitation);

  return {
    outcome: alreadyValidated ? 'already_used' : 'valid',
    scan_type: 'entry',
    guest_name: guestName,
    event_id: invitation.eventId,
    event_title: invitation.event.title,
    ticket_type: ticketType,
    entry_id: ticket.manualEntryId,
    ticket_id: ticket.id,
    transaction_id: ticket.manualEntryId,
    access_level: formatAccessLevel(invitation.tier),
    validated_at: alreadyValidated ? undefined : validatedAt?.toISOString(),
    last_used_at: alreadyValidated ? validatedAt?.toISOString() : undefined,
    qr_payload: ticket.qrPayload,
  };
}

async function buildProductScanResponse(
  scanInput: string,
  staffMember: StaffMember,
  alreadyRedeemed: boolean,
  validatedAt?: Date | null,
): Promise<StaffScanResponse> {
  const redemption = await findDrinkRedemptionByScanInput(scanInput);

  if (!redemption) {
    throw new AppError(404, 'DRINK_QR_NOT_FOUND', 'Drink order QR not found');
  }

  const line =
    redemption.line ??
    redemption.order.lines.find((item) => item.id === redemption.lineId) ??
    redemption.order.lines[0];

  const staff = await loadStaffContext(staffMember);

  return {
    outcome: alreadyRedeemed ? 'already_used' : 'valid',
    scan_type: 'product',
    guest_name: redemption.order.user.fullName,
    event_id: redemption.order.eventId,
    event_title: redemption.order.event.title,
    product_name: line?.productName ?? 'Product',
    product_quantity: line?.quantity ?? 1,
    entry_id: redemption.manualEntryId,
    transaction_id: redemption.manualEntryId,
    bar_name: staff.zone.label,
    validated_at: alreadyRedeemed ? undefined : validatedAt?.toISOString(),
    last_used_at: alreadyRedeemed ? validatedAt?.toISOString() : undefined,
    qr_payload: redemption.qrPayload,
  };
}

export const staffScanService = {
  async scanEntry(scanInput: string, staffMember: StaffMember): Promise<StaffScanResponse> {
    const data = await invitationDoorValidationService.validateQrPayload(scanInput);

    if ('already_validated' in data && data.already_validated) {
      const ticket = await findInvitationTicketByScanInput(scanInput);

      return finalizeScan(
        staffMember,
        await buildEntryScanResponse(scanInput, true, ticket?.validatedAt),
      );
    }

    const ticket = await findInvitationTicketByScanInput(scanInput);

    return finalizeScan(
      staffMember,
      await buildEntryScanResponse(scanInput, false, ticket?.validatedAt ?? new Date()),
    );
  },

  async scanProduct(scanInput: string, staffMember: StaffMember): Promise<StaffScanResponse> {
    try {
      const data = await eventDrinkRedemptionService.validateQrPayload(scanInput);
      return finalizeScan(staffMember, {
        outcome: 'valid',
        scan_type: 'product',
        guest_name: data.guest_name,
        event_id: data.event_id,
        event_title: data.event_title,
        product_name: data.line_items[0]?.product_name ?? 'Product',
        product_quantity: data.line_items[0]?.quantity ?? 1,
        entry_id: data.entry_code,
        transaction_id: data.entry_code,
        bar_name: (await loadStaffContext(staffMember)).zone.label,
        validated_at: data.redeemed_at,
        qr_payload: data.qr_payload ?? scanInput,
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'DRINK_QR_ALREADY_REDEEMED') {
        const redemption = await findDrinkRedemptionByScanInput(scanInput);
        return finalizeScan(
          staffMember,
          await buildProductScanResponse(
            scanInput,
            staffMember,
            true,
            redemption?.validatedAt,
          ),
        );
      }
      throw err;
    }
  },

  async listRecentScans(
    staffMember: StaffMember,
    scanType: StaffRecentScanType,
    limit = 10,
  ) {
    assertScanTypePermission(staffMember, scanType);

    const rows = await prisma.staffScanLog.findMany({
      where: {
        staffMemberId: staffMember.id,
        scanType,
      },
      orderBy: { scannedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return {
      scans: rows.map((row) => ({
        id: row.id,
        scan_type: row.scanType as StaffRecentScanType,
        outcome: row.outcome as StaffScanResponse['outcome'],
        item_name: row.itemName,
        guest_name: row.guestName,
        event_title: row.eventTitle,
        entry_id: row.entryId,
        transaction_id: row.transactionId,
        qr_payload: row.qrPayload,
        access_level: row.accessLevel,
        bar_name: row.barName,
        product_quantity: row.productQuantity,
        last_used_at: row.lastUsedAt?.toISOString(),
        scanned_at: row.scannedAt.toISOString(),
      })),
    };
  },

  async listActiveEvents(staffMember: StaffMember) {
    assertScanTypePermission(staffMember, 'entry');

    const events = await prisma.event.findMany({
      where: activeEventWindow(),
      select: {
        id: true,
        title: true,
        startsAt: true,
        city: true,
      },
      orderBy: { startsAt: 'asc' },
      take: 30,
    });

    return {
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        starts_at: event.startsAt.toISOString(),
        city: event.city,
      })),
    };
  },
};
