/** Permission IDs that unlock supervisor mode in the staff app. */
export const SUPERVISOR_ACCESS_PERMISSIONS = [
  'tickets_supervisor',
  'bar_supervisor',
  'general_admin',
] as const;

export type SupervisorAccessPermissionId = (typeof SUPERVISOR_ACCESS_PERMISSIONS)[number];

export function hasSupervisorAccess(permissionIds: string[]) {
  return permissionIds.some((permissionId) =>
    SUPERVISOR_ACCESS_PERMISSIONS.includes(permissionId as SupervisorAccessPermissionId),
  );
}

/** Permissions required for ticket/entry supervisor tools (search, override, manual validation). */
export const ENTRY_SUPERVISOR_PERMISSIONS = [
  'tickets_supervisor',
  'general_admin',
] as const;

export function hasEntrySupervisorAccess(permissionIds: string[]) {
  return permissionIds.some((permissionId) =>
    ENTRY_SUPERVISOR_PERMISSIONS.includes(
      permissionId as (typeof ENTRY_SUPERVISOR_PERMISSIONS)[number],
    ),
  );
}

/** Permissions required for bar/drink supervisor tools (search, cancellations, override). */
export const BAR_SUPERVISOR_PERMISSIONS = ['bar_supervisor', 'general_admin'] as const;

export function hasBarSupervisorAccess(permissionIds: string[]) {
  return permissionIds.some((permissionId) =>
    BAR_SUPERVISOR_PERMISSIONS.includes(
      permissionId as (typeof BAR_SUPERVISOR_PERMISSIONS)[number],
    ),
  );
}
