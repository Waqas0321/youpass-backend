import type { AuthRequestContext } from '../types/auth.js';

const MIN_DEVICE_ID_LENGTH = 8;

export function extractDeviceId(context?: AuthRequestContext): string | undefined {
  const raw = context?.deviceInfo?.deviceId;
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length >= MIN_DEVICE_ID_LENGTH ? trimmed : undefined;
}
