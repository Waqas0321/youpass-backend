export const DRINK_SUPERVISOR_ACTION_PREFIX = 'supervisor_drink_';

export const DRINK_CANCELLATION_ACTIONS = [
  'cancel_consumption',
  'revert_validation',
  'release_blocked_qr',
] as const;

export const DRINK_MANUAL_VALIDATION_ACTIONS = [
  'authorize_consumption',
  'generate_temporary_qr',
  'reject_consumption',
] as const;

export const DRINK_MANUAL_VALIDATION_REASONS = [
  'phone_battery',
  'no_connection',
  'damaged_qr',
  'broken_screen',
  'other',
] as const;

export const DRINK_OVERRIDE_ACTIONS = [
  'release_qr',
  'revalidate_qr',
  'revert_validation',
  'authorize_reconsumption',
  'temporary_unlock',
] as const;

export type DrinkCancellationAction = (typeof DRINK_CANCELLATION_ACTIONS)[number];
export type DrinkManualValidationAction = (typeof DRINK_MANUAL_VALIDATION_ACTIONS)[number];
export type DrinkManualValidationReason = (typeof DRINK_MANUAL_VALIDATION_REASONS)[number];
export type DrinkOverrideAction = (typeof DRINK_OVERRIDE_ACTIONS)[number];

export function formatDrinkSupervisorLogAction(
  scope: 'cancellation' | 'manual_validation' | 'override',
  action: string,
) {
  return `${DRINK_SUPERVISOR_ACTION_PREFIX}${scope}_${action}`;
}
