import type { StaffMember, StaffRole, StaffZone } from '@prisma/client';
import { formatPhoneDisplay } from '../../common/utils/phone.js';
import { formatAdminStaffRole, formatAdminStaffZone } from '../admin/admin-staff.formatter.js';

type StaffMemberWithRelations = StaffMember & {
  role: StaffRole;
  zone: StaffZone;
};

export function formatStaffAuthProfile(member: StaffMemberWithRelations) {
  const displayPhone = member.countryCode
    ? formatPhoneDisplay(member.phone, member.countryCode)
    : member.phone;

  return {
    id: member.id,
    name: member.name,
    phone: displayPhone,
    role: formatAdminStaffRole(member.role),
    zone: formatAdminStaffZone(member.zone),
    status: member.status,
    permission_ids: member.permissionIds,
  };
}
