import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { StaffRole, StaffZone } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { buildStaffQrImageDataUrl } from '../staff/staff-qr.js';
import { generateStaffQrPayload, generateStaffQrToken } from '../staff/staff.utils.js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_STAFF_ROLES,
  DEFAULT_STAFF_ZONES,
  STAFF_ASSIGNABLE_ROLE_SLUGS,
  STAFF_PERMISSIONS,
  STAFF_PERMISSION_IDS,
  STAFF_SCAN_PERMISSION_IDS,
} from './admin-staff.constants.js';
import {
  formatAdminStaffMember,
  formatAdminStaffQrResponse,
  formatAdminStaffRole,
  formatAdminStaffSupervisorPinResponse,
  formatAdminStaffZone,
} from './admin-staff.formatter.js';
import type {
  AdminCreateStaffInput,
  AdminCreateStaffRoleInput,
  AdminCreateStaffZoneInput,
  AdminUpdateStaffInput,
} from './admin-staff.validators.js';
import { isObjectId } from './admin-staff.validators.js';
import { staffSupervisorService } from '../staff-supervisor/staff-supervisor.service.js';

const CUSTOM_ROLE_COLORS = ['#9c5fd4', '#5b9cf6', '#ffb800', '#ff6b6b', '#f472b6', '#3ecf8e', '#a78bfa', '#38bdf8'];

const memberInclude = { role: true, zone: true } as const;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeStaffPhone(raw: string) {
  const parsed = parsePhoneNumberFromString(raw.trim());

  if (!parsed?.isValid()) {
    throw new AppError(400, 'INVALID_PHONE', 'Please enter a valid phone number');
  }

  return {
    e164: parsed.format('E.164'),
    countryCode: parsed.country ?? null,
  };
}

function sanitizePermissionIds(permissionIds?: string[]) {
  if (!permissionIds?.length) {
    return [];
  }

  const unique = [...new Set(permissionIds)];
  const invalid = unique.filter((permissionId) => !STAFF_PERMISSION_IDS.has(permissionId));

  if (invalid.length > 0) {
    throw new AppError(400, 'INVALID_STAFF_PERMISSION', 'One or more permissions are not allowed');
  }

  return unique;
}

function defaultPermissionsForRoleSlug(roleSlug: string) {
  return DEFAULT_ROLE_PERMISSIONS[roleSlug] ?? [];
}

function syncPermissionsForRoleChange(currentPermissionIds: string[], roleSlug: string) {
  const opposingSupervisor = roleSlug === 'bar' ? 'tickets_supervisor' : 'bar_supervisor';

  const preserved = currentPermissionIds.filter(
    (permissionId) =>
      !STAFF_SCAN_PERMISSION_IDS.includes(permissionId as (typeof STAFF_SCAN_PERMISSION_IDS)[number]) &&
      permissionId !== opposingSupervisor,
  );
  const roleDefaults = defaultPermissionsForRoleSlug(roleSlug);
  const scanPermissions = roleDefaults.filter((permissionId) =>
    STAFF_SCAN_PERMISSION_IDS.includes(permissionId as (typeof STAFF_SCAN_PERMISSION_IDS)[number]),
  );

  return sanitizePermissionIds([...preserved, ...scanPermissions]);
}

function assertAssignableRoleSlug(roleSlug: string) {
  if (!STAFF_ASSIGNABLE_ROLE_SLUGS.includes(roleSlug as (typeof STAFF_ASSIGNABLE_ROLE_SLUGS)[number])) {
    throw new AppError(
      400,
      'INVALID_STAFF_ROLE',
      'Only bar and tickets roles can be assigned to staff',
    );
  }
}

function nextCustomRoleColor(existingCount: number) {
  return CUSTOM_ROLE_COLORS[existingCount % CUSTOM_ROLE_COLORS.length] ?? '#ffb800';
}

async function ensureDefaultCatalog() {
  await Promise.all([
    ...DEFAULT_STAFF_ROLES.map((role) =>
      prisma.staffRole.upsert({
        where: { slug: role.slug },
        create: {
          slug: role.slug,
          label: role.label,
          color: role.color,
          displayOrder: role.displayOrder,
          isSystem: true,
        },
        update: {
          label: role.label,
          color: role.color,
          displayOrder: role.displayOrder,
          isSystem: true,
        },
      }),
    ),
    ...DEFAULT_STAFF_ZONES.map((zone) =>
      prisma.staffZone.upsert({
        where: { slug: zone.slug },
        create: {
          slug: zone.slug,
          label: zone.label,
          displayOrder: zone.displayOrder,
        },
        update: {},
      }),
    ),
  ]);
}

async function resolveRole(roleRef: string): Promise<StaffRole> {
  if (isObjectId(roleRef)) {
    const role = await prisma.staffRole.findUnique({ where: { id: roleRef } });

    if (!role) {
      throw new AppError(404, 'STAFF_ROLE_NOT_FOUND', 'Staff role not found');
    }

    return role;
  }

  const role = await prisma.staffRole.findUnique({ where: { slug: roleRef } });

  if (!role) {
    throw new AppError(404, 'STAFF_ROLE_NOT_FOUND', 'Staff role not found');
  }

  return role;
}

async function resolveOrCreateZone(zoneLabel: string): Promise<StaffZone> {
  const trimmed = zoneLabel.trim();
  const slug = slugify(trimmed);

  const existing = await prisma.staffZone.findFirst({
    where: {
      OR: [{ slug }, { label: { equals: trimmed, mode: 'insensitive' } }],
    },
  });

  if (existing) {
    return existing;
  }

  const count = await prisma.staffZone.count();

  return prisma.staffZone.create({
    data: {
      slug,
      label: trimmed,
      displayOrder: count + 1,
    },
  });
}

async function getMemberOrThrow(staffId: string) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffId },
    include: memberInclude,
  });

  if (!member) {
    throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found');
  }

  return member;
}

function buildQrCredentials(staffId: string) {
  return {
    qrToken: generateStaffQrToken(),
    qrPayload: generateStaffQrPayload(staffId),
  };
}

async function ensureMemberQrCredentials(staffId: string) {
  const member = await getMemberOrThrow(staffId);

  if (member.qrPayload && member.qrToken) {
    return member;
  }

  const credentials = buildQrCredentials(staffId);

  return prisma.staffMember.update({
    where: { id: staffId },
    data: credentials,
    include: memberInclude,
  });
}

async function formatMemberWithQrImage(staffId: string) {
  const member = await ensureMemberQrCredentials(staffId);
  const qrImage = await buildStaffQrImageDataUrl(member.qrPayload!);
  return formatAdminStaffQrResponse(member, qrImage);
}

export const adminStaffService = {
  async listRoles() {
    await ensureDefaultCatalog();

    const roles = await prisma.staffRole.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return roles.map(formatAdminStaffRole);
  },

  async listZones() {
    await ensureDefaultCatalog();

    const zones = await prisma.staffZone.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return zones.map(formatAdminStaffZone);
  },

  async listMembers() {
    await ensureDefaultCatalog();

    const members = await prisma.staffMember.findMany({
      include: memberInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return members.map(formatAdminStaffMember);
  },

  async createRole(input: AdminCreateStaffRoleInput) {
    await ensureDefaultCatalog();

    const label = input.label.trim();
    const slug = slugify(label);

    if (!slug) {
      throw new AppError(400, 'INVALID_STAFF_ROLE', 'Role label is invalid');
    }

    const existing = await prisma.staffRole.findUnique({ where: { slug } });

    if (existing) {
      throw new AppError(409, 'STAFF_ROLE_ALREADY_EXISTS', 'A role with this name already exists');
    }

    const count = await prisma.staffRole.count();
    const role = await prisma.staffRole.create({
      data: {
        slug,
        label,
        color: input.color ?? nextCustomRoleColor(count),
        displayOrder: count + 1,
        isSystem: false,
      },
    });

    return formatAdminStaffRole(role);
  },

  async createZone(input: AdminCreateStaffZoneInput) {
    await ensureDefaultCatalog();

    const zone = await resolveOrCreateZone(input.label);

    return formatAdminStaffZone(zone);
  },

  async createMember(input: AdminCreateStaffInput) {
    await ensureDefaultCatalog();

    const name = input.name.trim();
    const phone = normalizeStaffPhone(input.phone);
    const role = await resolveRole(input.role_id);
    const zone = await resolveOrCreateZone(input.zone);

    const duplicate = await prisma.staffMember.findUnique({
      where: { phone: phone.e164 },
      select: { id: true },
    });

    if (duplicate) {
      throw new AppError(
        409,
        'STAFF_PHONE_ALREADY_EXISTS',
        'A staff member with this phone number already exists',
      );
    }

    const permissionIds =
      input.permission_ids !== undefined
        ? sanitizePermissionIds(input.permission_ids)
        : defaultPermissionsForRoleSlug(role.slug);

    const created = await prisma.staffMember.create({
      data: {
        name,
        phone: phone.e164,
        countryCode: phone.countryCode,
        roleId: role.id,
        zoneId: zone.id,
        permissionIds,
        lastActivityAt: new Date(),
      },
      include: memberInclude,
    });

    const credentials = buildQrCredentials(created.id);
    const member = await prisma.staffMember.update({
      where: { id: created.id },
      data: credentials,
      include: memberInclude,
    });

    const qrImage = await buildStaffQrImageDataUrl(member.qrPayload!);
    return formatAdminStaffQrResponse(member, qrImage);
  },

  async updateMember(staffId: string, input: AdminUpdateStaffInput) {
    const existing = await getMemberOrThrow(staffId);

    const data: {
      status?: AdminUpdateStaffInput['status'];
      roleId?: string;
      permissionIds?: string[];
      lastActivityAt?: Date;
    } = {};

    if (input.status !== undefined) {
      data.status = input.status;
      data.lastActivityAt = new Date();
    }

    if (input.role_id !== undefined) {
      const role = await resolveRole(input.role_id);
      assertAssignableRoleSlug(role.slug);
      data.roleId = role.id;

      if (input.permission_ids === undefined) {
        data.permissionIds = syncPermissionsForRoleChange(existing.permissionIds, role.slug);
      }
    }

    if (input.permission_ids !== undefined) {
      data.permissionIds = sanitizePermissionIds(input.permission_ids);
    }

    const member = await prisma.staffMember.update({
      where: { id: staffId },
      data,
      include: memberInclude,
    });

    return formatAdminStaffMember(member);
  },

  async resetMemberQr(staffId: string) {
    await getMemberOrThrow(staffId);

    const credentials = buildQrCredentials(staffId);
    const member = await prisma.staffMember.update({
      where: { id: staffId },
      data: credentials,
      include: memberInclude,
    });

    const qrImage = await buildStaffQrImageDataUrl(member.qrPayload!);
    return formatAdminStaffQrResponse(member, qrImage);
  },

  async getSupervisorPin(staffId: string) {
    await getMemberOrThrow(staffId);
    const payload = await staffSupervisorService.getPinForAdmin(staffId);
    return formatAdminStaffSupervisorPinResponse(payload);
  },

  async resetSupervisorPin(staffId: string) {
    await getMemberOrThrow(staffId);
    const payload = await staffSupervisorService.resetPin(staffId);
    return formatAdminStaffSupervisorPinResponse(payload);
  },

  async deleteMember(staffId: string) {
    await getMemberOrThrow(staffId);

    await prisma.staffMember.delete({
      where: { id: staffId },
    });

    return { id: staffId, deleted: true };
  },

  async getMemberQr(staffId: string) {
    return formatMemberWithQrImage(staffId);
  },

  getPermissionCatalog() {
    return STAFF_PERMISSIONS.map((permission) => ({
      id: permission.id,
      label: permission.label,
      enabled: true,
    }));
  },

  async listAll() {
    await ensureDefaultCatalog();

    const [staff, roles, zones] = await Promise.all([
      this.listMembers(),
      this.listRoles(),
      this.listZones(),
    ]);

    return {
      staff,
      roles,
      zones: zones.map((zone) => zone.label),
      total: staff.length,
    };
  },
};
