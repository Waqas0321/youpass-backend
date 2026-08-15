import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

export function requireStaffPermission(...permissionIds: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const staffMember = req.staffMember;
      if (!staffMember) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const granted = new Set(staffMember.permissionIds ?? []);
      const allowed = permissionIds.some((permissionId) => granted.has(permissionId));

      if (!allowed) {
        throw new AppError(
          403,
          'STAFF_PERMISSION_DENIED',
          'You do not have permission to perform this action',
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
