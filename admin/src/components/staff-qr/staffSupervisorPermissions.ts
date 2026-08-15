/** Must stay aligned with backend `staff-permissions.constants.ts`. */
export const SUPERVISOR_ACCESS_PERMISSIONS = [
  'tickets_supervisor',
  'bar_supervisor',
  'general_admin',
] as const;

export function hasSupervisorAccess(permissionIds: string[]) {
  return permissionIds.some((permissionId) =>
    SUPERVISOR_ACCESS_PERMISSIONS.includes(
      permissionId as (typeof SUPERVISOR_ACCESS_PERMISSIONS)[number],
    ),
  );
}
