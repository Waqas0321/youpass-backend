import { prisma } from '../../../config/database.js';
import { AppError } from '../../../common/errors/app-error.js';
import { TEMPORARY_QR_VALIDITY_MINUTES } from '../staff-supervisor.constants.js';
import {
  CANCELLED_DRINK_ORDER_STATUSES,
  drinkRedemptionSearchInclude,
} from './staff-supervisor-drink-search.constants.js';
import { formatDrinkSearchDetailResponse } from './staff-supervisor-drink-search.formatter.js';
import {
  loadDrinkRedemptionById,
  resolveRedemptionLine,
  type DrinkRedemptionWithContext,
} from './staff-supervisor-drink-search.service.js';
import { assertBarSupervisorPin } from './staff-supervisor-drink-pin.service.js';
import {
  formatDrinkSupervisorLogAction,
  type DrinkCancellationAction,
  type DrinkManualValidationAction,
  type DrinkManualValidationReason,
  type DrinkOverrideAction,
} from './staff-supervisor-drink-audit.constants.js';

type ApplyDrinkActionInput = {
  pin: string;
  notes: string;
  reason?: DrinkManualValidationReason;
};

async function loadRedemptionOrThrow(redemptionId: string) {
  const redemption = await loadDrinkRedemptionById(redemptionId);

  if (!redemption) {
    throw new AppError(404, 'DRINK_REDEMPTION_NOT_FOUND', 'Drink redemption not found');
  }

  return redemption as DrinkRedemptionWithContext;
}

function assertRedemptionActionable(redemption: DrinkRedemptionWithContext) {
  if (
    CANCELLED_DRINK_ORDER_STATUSES.includes(
      redemption.order.status as (typeof CANCELLED_DRINK_ORDER_STATUSES)[number],
    )
  ) {
    throw new AppError(409, 'DRINK_ORDER_NOT_ACTIVE', 'This drink order is no longer active');
  }
}

async function clearDuplicateProductScans(manualEntryId: string) {
  await prisma.staffScanLog.deleteMany({
    where: {
      entryId: manualEntryId,
      scanType: 'product',
      outcome: 'already_used',
    },
  });
}

async function syncOrderRedemptionStatus(redemption: DrinkRedemptionWithContext) {
  const refreshed = await prisma.eventDrinkRedemption.findUnique({
    where: { id: redemption.id },
    include: drinkRedemptionSearchInclude,
  });

  if (!refreshed) {
    return;
  }

  const allRedeemed = refreshed.order.lines.every((line) => line.redemption?.validatedAt != null);

  await prisma.eventDrinkOrder.update({
    where: { id: refreshed.orderId },
    data: { status: allRedeemed ? 'redeemed' : 'confirmed' },
  });
}

async function logDrinkSupervisorAction(
  staffMemberId: string,
  redemption: DrinkRedemptionWithContext,
  scope: 'cancellation' | 'manual_validation' | 'override',
  action: string,
  staffName: string,
) {
  const line = resolveRedemptionLine(redemption);

  await prisma.staffScanLog.create({
    data: {
      staffMemberId,
      scanType: 'product',
      outcome: 'supervisor_resolved',
      guestName: redemption.order.user.fullName,
      itemName: formatDrinkSupervisorLogAction(scope, action),
      eventTitle: redemption.order.event.title,
      entryId: redemption.manualEntryId,
      transactionId: redemption.orderId,
      qrPayload: redemption.qrPayload,
      barName: staffName,
      productQuantity: line?.quantity ?? 1,
      lastUsedAt: redemption.validatedAt,
    },
  });
}

async function applyCancellationAction(
  redemption: DrinkRedemptionWithContext,
  staffMemberId: string,
  staffName: string,
  action: DrinkCancellationAction,
  _notes: string,
) {
  assertRedemptionActionable(redemption);
  const now = new Date();

  switch (action) {
    case 'cancel_consumption':
      await prisma.eventDrinkOrder.update({
        where: { id: redemption.orderId },
        data: { status: 'cancelled' },
      });
      break;
    case 'revert_validation':
      if (!redemption.validatedAt) {
        throw new AppError(409, 'DRINK_NOT_VALIDATED', 'This consumption has not been validated');
      }
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { validatedAt: null },
      });
      await syncOrderRedemptionStatus(redemption);
      break;
    case 'release_blocked_qr':
      await clearDuplicateProductScans(redemption.manualEntryId);
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { unlockAt: now },
      });
      break;
    default:
      throw new AppError(400, 'INVALID_DRINK_CANCELLATION_ACTION', 'Unsupported cancellation action');
  }

  await logDrinkSupervisorAction(staffMemberId, redemption, 'cancellation', action, staffName);

  return formatDrinkSearchDetailResponse(redemption.id);
}

async function applyManualValidationAction(
  redemption: DrinkRedemptionWithContext,
  staffMemberId: string,
  staffName: string,
  action: DrinkManualValidationAction,
  input: ApplyDrinkActionInput,
) {
  assertRedemptionActionable(redemption);
  const now = new Date();

  switch (action) {
    case 'authorize_consumption':
      if (redemption.validatedAt) {
        throw new AppError(409, 'DRINK_ALREADY_VALIDATED', 'This consumption has already been validated');
      }
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { validatedAt: now },
      });
      await syncOrderRedemptionStatus(redemption);
      break;
    case 'reject_consumption':
      await prisma.eventDrinkOrder.update({
        where: { id: redemption.orderId },
        data: { status: 'cancelled' },
      });
      break;
    case 'generate_temporary_qr':
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { unlockAt: now },
      });
      break;
    default:
      throw new AppError(
        400,
        'INVALID_DRINK_MANUAL_VALIDATION_ACTION',
        'Unsupported manual validation action',
      );
  }

  await logDrinkSupervisorAction(
    staffMemberId,
    redemption,
    'manual_validation',
    action,
    staffName,
  );

  const detail = await formatDrinkSearchDetailResponse(redemption.id);

  if (action === 'generate_temporary_qr' && detail) {
    return {
      applied: true,
      action,
      reason: input.reason ?? null,
      notes: input.notes.trim(),
      redemption_id: redemption.id,
      temporary_qr: {
        qr_payload: detail.qr_payload,
        consumption_id: detail.consumption_id,
        guest_name: detail.guest_name,
        validity_minutes: TEMPORARY_QR_VALIDITY_MINUTES,
      },
      detail,
    };
  }

  return {
    applied: true,
    action,
    reason: input.reason ?? null,
    notes: input.notes.trim(),
    redemption_id: redemption.id,
    detail,
  };
}

async function applyOverrideAction(
  redemption: DrinkRedemptionWithContext,
  staffMemberId: string,
  staffName: string,
  action: DrinkOverrideAction,
  notes: string,
) {
  assertRedemptionActionable(redemption);
  const now = new Date();

  switch (action) {
    case 'release_qr':
      await clearDuplicateProductScans(redemption.manualEntryId);
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { unlockAt: now },
      });
      break;
    case 'revalidate_qr':
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { validatedAt: now },
      });
      await syncOrderRedemptionStatus(redemption);
      break;
    case 'revert_validation':
      if (!redemption.validatedAt) {
        throw new AppError(409, 'DRINK_NOT_VALIDATED', 'This consumption has not been validated');
      }
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { validatedAt: null },
      });
      await syncOrderRedemptionStatus(redemption);
      break;
    case 'authorize_reconsumption':
      await clearDuplicateProductScans(redemption.manualEntryId);
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { validatedAt: null, unlockAt: now },
      });
      await syncOrderRedemptionStatus(redemption);
      break;
    case 'temporary_unlock':
      await prisma.eventDrinkRedemption.update({
        where: { id: redemption.id },
        data: { unlockAt: now },
      });
      break;
    default:
      throw new AppError(400, 'INVALID_DRINK_OVERRIDE_ACTION', 'Unsupported override action');
  }

  await logDrinkSupervisorAction(staffMemberId, redemption, 'override', action, staffName);

  return {
    applied: true,
    action,
    notes: notes.trim(),
    redemption_id: redemption.id,
    detail: await formatDrinkSearchDetailResponse(redemption.id),
  };
}

export const staffSupervisorDrinkActionsService = {
  async applyCancellation(
    redemptionId: string,
    staffMemberId: string,
    input: ApplyDrinkActionInput & { action: DrinkCancellationAction },
  ) {
    const staff = await assertBarSupervisorPin(staffMemberId, input.pin);
    const redemption = await loadRedemptionOrThrow(redemptionId);
    const detail = await applyCancellationAction(
      redemption,
      staffMemberId,
      staff.name,
      input.action,
      input.notes,
    );

    return {
      applied: true,
      action: input.action,
      notes: input.notes.trim(),
      redemption_id: redemptionId,
      detail,
    };
  },

  async applyManualValidation(
    redemptionId: string,
    staffMemberId: string,
    input: ApplyDrinkActionInput & {
      action: DrinkManualValidationAction;
      reason: DrinkManualValidationReason;
    },
  ) {
    const staff = await assertBarSupervisorPin(staffMemberId, input.pin);
    const redemption = await loadRedemptionOrThrow(redemptionId);
    return applyManualValidationAction(
      redemption,
      staffMemberId,
      staff.name,
      input.action,
      input,
    );
  },

  async applyOverride(
    redemptionId: string,
    staffMemberId: string,
    input: ApplyDrinkActionInput & { action: DrinkOverrideAction },
  ) {
    const staff = await assertBarSupervisorPin(staffMemberId, input.pin);
    const redemption = await loadRedemptionOrThrow(redemptionId);
    return applyOverrideAction(
      redemption,
      staffMemberId,
      staff.name,
      input.action,
      input.notes,
    );
  },
};
