import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export function generateStaffQrToken() {
  return `staff_qr_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateStaffQrPayload(staffId: string) {
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`staff.${staffId}`)
    .digest('hex')
    .slice(0, 10);

  return `staff.${staffId}.${signature}`;
}
