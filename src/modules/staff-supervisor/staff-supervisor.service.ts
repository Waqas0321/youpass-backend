import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { generateOtp, hashOtp, verifyOtp } from '../../common/utils/crypto.js';
import { hasSupervisorAccess } from '../staff/staff-permissions.constants.js';
import { SUPERVISOR_PIN_LENGTH } from './staff-supervisor.constants.js';
import {
  decryptSupervisorPin,
  encryptSupervisorPin,
} from './staff-supervisor-pin-crypto.js';
import type { StaffSupervisorValidatePinInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorSearchEntriesQuery } from './staff-supervisor.validators.js';
import {
  formatEntryHistoryResponse,
  formatEntrySearchDetailResponse,
  formatEntrySearchSummaries,
  searchSupervisorEntries,
} from './staff-supervisor-entry-search.formatter.js';
import { ticketSearchInclude, type TicketWithInvitation } from './staff-supervisor-entry-search.service.js';
import { staffSupervisorDuplicateService } from './staff-supervisor-duplicate.service.js';
import { staffSupervisorEntryOverrideService } from './staff-supervisor-entry-override.service.js';
import { staffSupervisorEntryManualValidationService } from './staff-supervisor-entry-manual-validation.service.js';
import { staffSupervisorVipManagementService } from './staff-supervisor-vip-management.service.js';
import { staffSupervisorSystemStatusService } from './staff-supervisor-system-status.service.js';
import { staffSupervisorActionHistoryService } from './staff-supervisor-action-history.service.js';
import { staffSupervisorDrinkActionsService } from './drinks/staff-supervisor-drink-actions.service.js';
import { staffSupervisorDrinkActionHistoryService } from './drinks/staff-supervisor-drink-action-history.service.js';
import {
  formatDrinkSearchDetailResponse,
  formatDrinkSearchSummaries,
  searchSupervisorDrinks,
} from './drinks/staff-supervisor-drink-search.formatter.js';
import type {
  StaffSupervisorSearchDrinksQuery,
  StaffSupervisorDrinkActionHistoryQuery,
  StaffSupervisorApplyDrinkCancellationInput,
  StaffSupervisorApplyDrinkManualValidationInput,
  StaffSupervisorApplyDrinkOverrideInput,
} from './drinks/staff-supervisor-drink.validators.js';
import type { StaffSupervisorApplyEntryManualValidationInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorApplyVipTableActionInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorApplyEntryOverrideInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorResolveDuplicateInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorApplySystemStatusActionInput } from './staff-supervisor.validators.js';
import type { StaffSupervisorSystemStatusQuery } from './staff-supervisor.validators.js';
import type { StaffSupervisorActionHistoryQuery } from './staff-supervisor.validators.js';

export const staffSupervisorService = {
  async validatePin(staffMemberId: string, input: StaffSupervisorValidatePinInput) {
    const member = await prisma.staffMember.findUnique({
      where: { id: staffMemberId },
      select: {
        id: true,
        permissionIds: true,
        supervisorPinHash: true,
      },
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

    const isValid = await verifyOtp(input.pin, member.supervisorPinHash);

    if (!isValid) {
      throw new AppError(401, 'SUPERVISOR_PIN_INVALID', 'Incorrect supervisor PIN');
    }

    return { valid: true };
  },

  async searchEntries(query: StaffSupervisorSearchEntriesQuery) {
    const tickets = await searchSupervisorEntries(query);
    return formatEntrySearchSummaries(tickets);
  },

  async searchDrinks(query: StaffSupervisorSearchDrinksQuery) {
    const redemptions = await searchSupervisorDrinks(query);
    return formatDrinkSearchSummaries(redemptions);
  },

  async getDrinkDetail(redemptionId: string) {
    const detail = await formatDrinkSearchDetailResponse(redemptionId);

    if (!detail) {
      throw new AppError(404, 'DRINK_REDEMPTION_NOT_FOUND', 'Drink redemption not found');
    }

    return detail;
  },

  applyDrinkCancellation(
    redemptionId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyDrinkCancellationInput,
  ) {
    return staffSupervisorDrinkActionsService.applyCancellation(
      redemptionId,
      staffMemberId,
      input,
    );
  },

  applyDrinkManualValidation(
    redemptionId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyDrinkManualValidationInput,
  ) {
    return staffSupervisorDrinkActionsService.applyManualValidation(
      redemptionId,
      staffMemberId,
      input,
    );
  },

  applyDrinkOverride(
    redemptionId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyDrinkOverrideInput,
  ) {
    return staffSupervisorDrinkActionsService.applyOverride(redemptionId, staffMemberId, input);
  },

  getDrinkActionHistory(query: StaffSupervisorDrinkActionHistoryQuery) {
    return staffSupervisorDrinkActionHistoryService.getActionHistory(query);
  },

  async getEntryDetail(ticketId: string) {
    const ticket = await prisma.invitationTicket.findFirst({
      where: { id: ticketId },
      include: ticketSearchInclude,
    });

    if (!ticket) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'Entry not found');
    }

    return formatEntrySearchDetailResponse(ticket as TicketWithInvitation);
  },

  async getEntryHistory(ticketId: string) {
    const ticket = await prisma.invitationTicket.findFirst({
      where: { id: ticketId },
      include: ticketSearchInclude,
    });

    if (!ticket) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'Entry not found');
    }

    return formatEntryHistoryResponse(ticket as TicketWithInvitation);
  },

  async getDuplicateAlert(ticketId: string) {
    return staffSupervisorDuplicateService.getDuplicateAlert(ticketId);
  },

  async getDuplicateAlertByEntryCode(entryCode: string) {
    return staffSupervisorDuplicateService.getDuplicateAlertByEntryCode(entryCode);
  },

  async resolveDuplicate(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorResolveDuplicateInput,
  ) {
    return staffSupervisorDuplicateService.resolveDuplicate(ticketId, staffMemberId, input);
  },

  async resolveDuplicateByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorResolveDuplicateInput,
  ) {
    return staffSupervisorDuplicateService.resolveDuplicateByEntryCode(
      entryCode,
      staffMemberId,
      input,
    );
  },

  async getEntryOverrideContext(ticketId: string) {
    return staffSupervisorEntryOverrideService.getOverrideContext(ticketId);
  },

  async getEntryOverrideContextByEntryCode(entryCode: string) {
    return staffSupervisorEntryOverrideService.getOverrideContextByEntryCode(entryCode);
  },

  async applyEntryOverride(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryOverrideInput,
  ) {
    return staffSupervisorEntryOverrideService.applyOverride(ticketId, staffMemberId, input);
  },

  async applyEntryOverrideByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryOverrideInput,
  ) {
    return staffSupervisorEntryOverrideService.applyOverrideByEntryCode(
      entryCode,
      staffMemberId,
      input,
    );
  },

  async getEntryManualValidationContext(ticketId: string) {
    return staffSupervisorEntryManualValidationService.getManualValidationContext(ticketId);
  },

  async getEntryManualValidationContextByEntryCode(entryCode: string) {
    return staffSupervisorEntryManualValidationService.getManualValidationContextByEntryCode(
      entryCode,
    );
  },

  async applyEntryManualValidation(
    ticketId: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryManualValidationInput,
  ) {
    return staffSupervisorEntryManualValidationService.applyManualValidation(
      ticketId,
      staffMemberId,
      input,
    );
  },

  async applyEntryManualValidationByEntryCode(
    entryCode: string,
    staffMemberId: string,
    input: StaffSupervisorApplyEntryManualValidationInput,
  ) {
    return staffSupervisorEntryManualValidationService.applyManualValidationByEntryCode(
      entryCode,
      staffMemberId,
      input,
    );
  },

  searchVipTables(query: string) {
    return staffSupervisorVipManagementService.searchVipTables(query);
  },

  getVipTableContext(orderId: string) {
    return staffSupervisorVipManagementService.getVipTableContext(orderId);
  },

  applyVipTableAction(
    orderId: string,
    staffMemberId: string,
    staffName: string,
    input: StaffSupervisorApplyVipTableActionInput,
  ) {
    return staffSupervisorVipManagementService.applyVipTableAction(
      orderId,
      staffMemberId,
      staffName,
      input,
    );
  },

  getSystemStatus(query: StaffSupervisorSystemStatusQuery) {
    return staffSupervisorSystemStatusService.getSystemStatus(query);
  },

  applySystemStatusAction(
    staffMemberId: string,
    input: StaffSupervisorApplySystemStatusActionInput,
  ) {
    return staffSupervisorSystemStatusService.applySystemStatusAction(staffMemberId, input);
  },

  getActionHistory(query: StaffSupervisorActionHistoryQuery) {
    return staffSupervisorActionHistoryService.getActionHistory(query);
  },

  async getPinForAdmin(staffId: string) {
    const member = await prisma.staffMember.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        supervisorPinHash: true,
        supervisorPinEncrypted: true,
        updatedAt: true,
      },
    });

    if (!member) {
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found');
    }

    if (!member.supervisorPinHash) {
      throw new AppError(
        404,
        'SUPERVISOR_PIN_NOT_CONFIGURED',
        'Supervisor PIN has not been configured yet',
      );
    }

    if (!member.supervisorPinEncrypted) {
      throw new AppError(
        409,
        'SUPERVISOR_PIN_NOT_VIEWABLE',
        'This PIN was created before admin viewing was enabled. Reset it to view the new PIN.',
      );
    }

    try {
      const pin = decryptSupervisorPin(member.supervisorPinEncrypted);
      return {
        staff_id: staffId,
        pin,
        updated_at: member.updatedAt.toISOString(),
      };
    } catch {
      throw new AppError(
        500,
        'SUPERVISOR_PIN_DECRYPT_FAILED',
        'Could not read the supervisor PIN. Reset it and try again.',
      );
    }
  },

  async resetPin(staffId: string) {
    const member = await prisma.staffMember.findUnique({
      where: { id: staffId },
      select: { id: true },
    });

    if (!member) {
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found');
    }

    const pin = generateOtp(SUPERVISOR_PIN_LENGTH);
    const supervisorPinHash = await hashOtp(pin);
    const supervisorPinEncrypted = encryptSupervisorPin(pin);

    const updated = await prisma.staffMember.update({
      where: { id: staffId },
      data: {
        supervisorPinHash,
        supervisorPinEncrypted,
      },
      select: { updatedAt: true },
    });

    return {
      staff_id: staffId,
      pin,
      updated_at: updated.updatedAt.toISOString(),
    };
  },
};
