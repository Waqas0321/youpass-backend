import { z } from 'zod';
import { STAFF_PERMISSION_IDS } from './admin-staff.constants.js';

const objectIdPattern = /^[a-f0-9]{24}$/i;

export const adminCreateStaffSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().min(6, 'Phone is required').max(32),
  role_id: z.string().trim().min(1, 'Role is required').max(64),
  zone: z.string().trim().min(1, 'Zone is required').max(120),
  permission_ids: z
    .array(z.string().trim().min(1).max(64))
    .max(STAFF_PERMISSION_IDS.size)
    .optional(),
});

export const adminCreateStaffRoleSchema = z.object({
  label: z.string().trim().min(1).max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const adminCreateStaffZoneSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export const adminUpdateStaffSchema = z
  .object({
    status: z.enum(['online', 'away', 'paused']).optional(),
    role_id: z.string().trim().min(1).max(64).optional(),
    permission_ids: z
      .array(z.string().trim().min(1).max(64))
      .max(STAFF_PERMISSION_IDS.size)
      .optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.role_id !== undefined ||
      value.permission_ids !== undefined,
    {
      message: 'At least one field is required',
    },
  );

export type AdminCreateStaffInput = z.infer<typeof adminCreateStaffSchema>;
export type AdminCreateStaffRoleInput = z.infer<typeof adminCreateStaffRoleSchema>;
export type AdminCreateStaffZoneInput = z.infer<typeof adminCreateStaffZoneSchema>;
export type AdminUpdateStaffInput = z.infer<typeof adminUpdateStaffSchema>;

export function isObjectId(value: string) {
  return objectIdPattern.test(value);
}
