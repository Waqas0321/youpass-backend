import { prisma } from '../../../config/database.js';
import { AppError } from '../../../common/errors/app-error.js';
import { verifyOtp } from '../../../common/utils/crypto.js';
import { hasBarSupervisorAccess } from '../../staff/staff-permissions.constants.js';

export async function assertBarSupervisorPin(staffMemberId: string, pin: string) {
  const member = await prisma.staffMember.findUnique({
    where: { id: staffMemberId },
    select: {
      id: true,
      name: true,
      permissionIds: true,
      supervisorPinHash: true,
      zone: { select: { label: true } },
    },
  });

  if (!member) {
    throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff account not found');
  }

  if (!hasBarSupervisorAccess(member.permissionIds)) {
    throw new AppError(
      403,
      'BAR_SUPERVISOR_ACCESS_DENIED',
      'This staff account is not authorized for bar supervisor mode',
    );
  }

  if (!member.supervisorPinHash) {
    throw new AppError(
      403,
      'SUPERVISOR_PIN_NOT_CONFIGURED',
      'Supervisor PIN has not been configured by an administrator',
    );
  }

  const isValid = await verifyOtp(pin, member.supervisorPinHash);

  if (!isValid) {
    throw new AppError(401, 'SUPERVISOR_PIN_INVALID', 'Incorrect supervisor PIN');
  }

  return member;
}
