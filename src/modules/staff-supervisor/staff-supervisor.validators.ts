import { z } from 'zod';
import { SUPERVISOR_PIN_LENGTH } from './staff-supervisor.constants.js';

export const staffSupervisorValidatePinSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PIN must contain digits only')
    .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
});

export type StaffSupervisorValidatePinInput = z.infer<typeof staffSupervisorValidatePinSchema>;

export const staffSupervisorSearchEntriesQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    filter: z.enum(['vip', 'used', 'error', 'duplicate']).optional(),
    event_id: z.string().trim().optional(),
  })
  .refine((data) => (data.q !== undefined && data.q.length >= 1) || data.filter !== undefined, {
    message: 'Provide a search term or a quick filter',
  });

export type StaffSupervisorSearchEntriesQuery = z.infer<
  typeof staffSupervisorSearchEntriesQuerySchema
>;

export const staffSupervisorEntryTicketParamsSchema = z.object({
  ticketId: z.string().trim().min(1),
});

export type StaffSupervisorEntryTicketParams = z.infer<
  typeof staffSupervisorEntryTicketParamsSchema
>;

export const staffSupervisorEntryCodeParamsSchema = z.object({
  entryCode: z.string().trim().min(1),
});

export type StaffSupervisorEntryCodeParams = z.infer<
  typeof staffSupervisorEntryCodeParamsSchema
>;

export const staffSupervisorResolveDuplicateSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PIN must contain digits only')
    .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
  action: z.enum(['revalidate_qr', 'release_reentry', 'block_qr', 'escalate_alert']),
  reason: z.enum([
    'shared_screenshot',
    'resold_qr',
    'validation_error',
    'authorized_reentry',
    'other',
  ]),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorResolveDuplicateInput = z.infer<
  typeof staffSupervisorResolveDuplicateSchema
>;

export const staffSupervisorApplyEntryOverrideSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PIN must contain digits only')
    .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
  action: z.enum([
    'release_qr',
    'revalidate_qr',
    'revert_validation',
    'authorize_reentry',
    'temporary_unlock',
  ]),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorApplyEntryOverrideInput = z.infer<
  typeof staffSupervisorApplyEntryOverrideSchema
>;

export const staffSupervisorApplyEntryManualValidationSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d+$/, 'PIN must contain digits only')
    .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
  action: z.enum(['authorize_entry', 'generate_temporary_qr', 'reject_access']),
  reason: z.enum([
    'phone_battery',
    'no_connection',
    'damaged_qr',
    'broken_screen',
    'other',
  ]),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorApplyEntryManualValidationInput = z.infer<
  typeof staffSupervisorApplyEntryManualValidationSchema
>;

export const staffSupervisorSearchVipTablesQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search term must be at least 2 characters'),
});

export type StaffSupervisorSearchVipTablesQuery = z.infer<
  typeof staffSupervisorSearchVipTablesQuerySchema
>;

export const staffSupervisorVipTableOrderParamsSchema = z.object({
  orderId: z.string().trim().min(1),
});

export type StaffSupervisorVipTableOrderParams = z.infer<
  typeof staffSupervisorVipTableOrderParamsSchema
>;

export const staffSupervisorApplyVipTableActionSchema = z
  .object({
    pin: z
      .string()
      .trim()
      .regex(/^\d+$/, 'PIN must contain digits only')
      .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
    action: z.enum([
      'authorize_extra_guest',
      'change_access',
      'move_guest',
      'release_invitation',
    ]),
    guest_name: z.string().trim().min(1).max(120).optional(),
    guest_phone: z.string().trim().min(6).max(32).optional(),
    guest_country_code: z.string().trim().length(2).optional(),
    slot_id: z.string().trim().min(1).optional(),
    target_slot_id: z.string().trim().min(1).optional(),
    access_label: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().min(1, 'Authorization reason is required').max(500),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'authorize_extra_guest') {
      if (!data.guest_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guest_name'],
          message: 'Guest name is required',
        });
      }
      if (!data.guest_phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guest_phone'],
          message: 'Guest phone is required',
        });
      }
      return;
    }

    if (!data.slot_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slot_id'],
        message: 'Select a guest before continuing',
      });
    }

    if (data.action === 'move_guest' && !data.target_slot_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_slot_id'],
        message: 'Select a destination seat',
      });
    }

    if (data.action === 'change_access' && !data.access_label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['access_label'],
        message: 'Select a VIP access level',
      });
    }
  });

export type StaffSupervisorApplyVipTableActionInput = z.infer<
  typeof staffSupervisorApplyVipTableActionSchema
>;

export const staffSupervisorSystemStatusQuerySchema = z.object({
  event_id: z.string().trim().optional(),
});

export type StaffSupervisorSystemStatusQuery = z.infer<
  typeof staffSupervisorSystemStatusQuerySchema
>;

export const staffSupervisorApplySystemStatusActionSchema = z
  .object({
    pin: z
      .string()
      .trim()
      .regex(/^\d+$/, 'PIN must contain digits only')
      .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`),
    action: z.enum([
      'offline_mode',
      'pause_validations',
      'block_vip',
      'staff_alert',
      'restart_scanner',
    ]),
    event_id: z.string().trim().optional(),
    scanner_id: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'staff_alert' && (!data.notes || data.notes.trim().length < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Alert message is required',
      });
    }

    if (data.action === 'restart_scanner' && !data.scanner_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scanner_id'],
        message: 'Scanner id is required',
      });
    }
  });

export type StaffSupervisorApplySystemStatusActionInput = z.infer<
  typeof staffSupervisorApplySystemStatusActionSchema
>;

export const staffSupervisorActionHistoryQuerySchema = z.object({
  event_id: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type StaffSupervisorActionHistoryQuery = z.infer<
  typeof staffSupervisorActionHistoryQuerySchema
>;
