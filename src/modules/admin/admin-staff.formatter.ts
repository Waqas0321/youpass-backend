import type { StaffMember, StaffRole, StaffZone } from '@prisma/client';
import { formatPhoneDisplay } from '../../common/utils/phone.js';

type StaffMemberWithRelations = StaffMember & {
  role: StaffRole;
  zone: StaffZone;
};

export function formatAdminStaffRole(role: StaffRole) {
  return {
    id: role.id,
    slug: role.slug,
    label: role.label,
    color: role.color,
  };
}

export function formatAdminStaffZone(zone: StaffZone) {
  return {
    id: zone.id,
    label: zone.label,
  };
}

export function formatAdminStaffMember(member: StaffMemberWithRelations) {
  const displayPhone = member.countryCode
    ? formatPhoneDisplay(member.phone, member.countryCode)
    : member.phone;

  return {
    id: member.id,
    name: member.name,
    phone: displayPhone,
    role_id: member.roleId,
    zone: member.zone.label,
    status: member.status,
    permission_ids: member.permissionIds,
    qr_payload: member.qrPayload,
    has_supervisor_pin: Boolean(member.supervisorPinHash),
    last_activity_at: (member.lastActivityAt ?? member.createdAt).toISOString(),
  };
}

export function formatAdminStaffQrResponse(
  member: StaffMemberWithRelations,
  qrImage: string,
) {
  return {
    ...formatAdminStaffMember(member),
    qr_token: member.qrToken,
    qr_image: qrImage,
  };
}

export function formatAdminStaffSupervisorPinResponse(payload: {
  staff_id: string;
  pin: string;
  updated_at: string;
}) {
  return payload;
}
