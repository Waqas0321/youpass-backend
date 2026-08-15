import { z } from 'zod';
import { SUPERVISOR_PIN_LENGTH } from '../staff-supervisor.constants.js';

export const staffSupervisorSearchDrinksQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    filter: z.enum(['validated', 'pending', 'cancelled', 'duplicate']).optional(),
    event_id: z.string().trim().optional(),
  })
  .refine((data) => (data.q !== undefined && data.q.length >= 1) || data.filter !== undefined, {
    message: 'Provide a search term or a quick filter',
  });

export type StaffSupervisorSearchDrinksQuery = z.infer<
  typeof staffSupervisorSearchDrinksQuerySchema
>;

export const staffSupervisorDrinkRedemptionParamsSchema = z.object({
  redemptionId: z.string().trim().min(1),
});

export type StaffSupervisorDrinkRedemptionParams = z.infer<
  typeof staffSupervisorDrinkRedemptionParamsSchema
>;

const supervisorPinField = z
  .string()
  .trim()
  .regex(/^\d+$/, 'PIN must contain digits only')
  .length(SUPERVISOR_PIN_LENGTH, `PIN must be ${SUPERVISOR_PIN_LENGTH} digits`);

export const staffSupervisorApplyDrinkCancellationSchema = z.object({
  pin: supervisorPinField,
  action: z.enum(['cancel_consumption', 'revert_validation', 'release_blocked_qr']),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorApplyDrinkCancellationInput = z.infer<
  typeof staffSupervisorApplyDrinkCancellationSchema
>;

export const staffSupervisorApplyDrinkManualValidationSchema = z.object({
  pin: supervisorPinField,
  action: z.enum(['authorize_consumption', 'generate_temporary_qr', 'reject_consumption']),
  reason: z.enum(['phone_battery', 'no_connection', 'damaged_qr', 'broken_screen', 'other']),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorApplyDrinkManualValidationInput = z.infer<
  typeof staffSupervisorApplyDrinkManualValidationSchema
>;

export const staffSupervisorApplyDrinkOverrideSchema = z.object({
  pin: supervisorPinField,
  action: z.enum([
    'release_qr',
    'revalidate_qr',
    'revert_validation',
    'authorize_reconsumption',
    'temporary_unlock',
  ]),
  notes: z.string().trim().min(1, 'Reason notes are required').max(500),
});

export type StaffSupervisorApplyDrinkOverrideInput = z.infer<
  typeof staffSupervisorApplyDrinkOverrideSchema
>;

export const staffSupervisorDrinkActionHistoryQuerySchema = z.object({
  event_id: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type StaffSupervisorDrinkActionHistoryQuery = z.infer<
  typeof staffSupervisorDrinkActionHistoryQuerySchema
>;
