import type { AdminStaffRole } from '../../api/client';

export const STAFF_ASSIGNABLE_ROLE_SLUGS = ['bar', 'tickets'] as const;

export const LEGACY_BAR_ROLE_SLUGS = ['bar', 'bartender'] as const;
export const LEGACY_TICKETS_ROLE_SLUGS = ['tickets', 'general_access'] as const;

export type StaffRoleKind = (typeof STAFF_ASSIGNABLE_ROLE_SLUGS)[number];

export function normalizedStaffRoleKind(slug: string | undefined | null): StaffRoleKind | null {
  if (!slug) {
    return null;
  }

  if (LEGACY_BAR_ROLE_SLUGS.includes(slug as (typeof LEGACY_BAR_ROLE_SLUGS)[number])) {
    return 'bar';
  }

  if (LEGACY_TICKETS_ROLE_SLUGS.includes(slug as (typeof LEGACY_TICKETS_ROLE_SLUGS)[number])) {
    return 'tickets';
  }

  return null;
}

export function filterAssignableStaffRoles(roles: AdminStaffRole[]) {
  const bySlug = new Map(roles.map((role) => [role.slug ?? role.id, role]));

  return STAFF_ASSIGNABLE_ROLE_SLUGS.map((slug) => bySlug.get(slug)).filter(
    (role): role is AdminStaffRole => role != null,
  );
}

export function isAssignableStaffRoleSlug(slug: string | undefined | null) {
  return slug != null && STAFF_ASSIGNABLE_ROLE_SLUGS.includes(slug as StaffRoleKind);
}

export function resolveAssignableRoleId(
  memberRoleId: string,
  allRoles: AdminStaffRole[],
  assignableRoles: AdminStaffRole[],
) {
  const memberRole = allRoles.find((role) => role.id === memberRoleId);
  const kind = normalizedStaffRoleKind(memberRole?.slug);

  if (!kind) {
    return memberRoleId;
  }

  return assignableRoles.find((role) => role.slug === kind)?.id ?? memberRoleId;
}

export function roleSlugForMember(memberRoleId: string, allRoles: AdminStaffRole[]) {
  return allRoles.find((role) => role.id === memberRoleId)?.slug ?? memberRoleId;
}
