import crypto from 'node:crypto';
import { env } from '../../config/env.js';

export function generateStaffQrToken() {
  return `staff_qr_${crypto.randomBytes(16).toString('hex')}`;
}

/** Signs with the current QR token so "Reset QR" yields a new payload (old badge stops matching). */
export function generateStaffQrPayload(staffId: string, qrToken: string) {
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`staff.${staffId}.${qrToken}`)
    .digest('hex')
    .slice(0, 10);

  return `staff.${staffId}.${signature}`;
}
