import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const HMAC_VERSION = 'v1';

function rootSecret(): string {
  return env.STAFF_OFFLINE_HMAC_SECRET || env.JWT_SECRET;
}

/** Per-session signing key returned to the staff device at login. */
export function deriveStaffOfflineSigningSecret(
  staffMemberId: string,
  sessionId: string,
): string {
  return crypto
    .createHmac('sha256', rootSecret())
    .update(`staff:${staffMemberId}:session:${sessionId}`)
    .digest('hex');
}

export function buildOfflineScanCanonical(input: {
  clientScanId: string;
  scanType: string;
  qrPayload: string;
  scannedAt: string;
  deviceId: string;
}): string {
  return [
    HMAC_VERSION,
    input.clientScanId,
    input.scanType,
    input.qrPayload,
    input.scannedAt,
    input.deviceId,
  ].join('|');
}

export function signOfflineScan(
  signingSecret: string,
  input: {
    clientScanId: string;
    scanType: string;
    qrPayload: string;
    scannedAt: string;
    deviceId: string;
  },
): string {
  return crypto
    .createHmac('sha256', signingSecret)
    .update(buildOfflineScanCanonical(input))
    .digest('hex');
}

export function verifyOfflineScanHmac(
  signingSecret: string,
  input: {
    clientScanId: string;
    scanType: string;
    qrPayload: string;
    scannedAt: string;
    deviceId: string;
  },
  providedHmac: string,
): boolean {
  const expected = signOfflineScan(signingSecret, input);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(providedHmac.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
