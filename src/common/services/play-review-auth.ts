import { AppError } from '../errors/app-error.js';
import { AUTH_ERROR_CODES } from '../../config/constants.js';
import { env } from '../../config/env.js';

/** Private / review login — fixed phones + OTP that never need WhatsApp. */

export function normalizeReviewPhone(phone: string): string {
  return phone.replace(/\s+/g, '').trim();
}

export function getPlayReviewOtp(): string | null {
  const otp = env.PLAY_REVIEW_OTP.trim();
  if (!otp || !/^\d{4,8}$/.test(otp)) {
    return null;
  }
  return otp;
}

/** Customer (consumer) review / private-access account phone. */
export function isPlayReviewCustomerPhone(e164: string): boolean {
  const configured = normalizeReviewPhone(env.PLAY_REVIEW_PHONE);
  if (!configured) {
    return false;
  }
  return normalizeReviewPhone(e164) === configured;
}

/** Staff review / private-access account phone. */
export function isPlayReviewStaffPhone(e164: string): boolean {
  const configured = normalizeReviewPhone(env.PLAY_REVIEW_STAFF_PHONE);
  if (!configured) {
    return false;
  }
  return normalizeReviewPhone(e164) === configured;
}

/** Any Play review phone (customer or staff). */
export function isPlayReviewPhone(e164: string): boolean {
  return isPlayReviewCustomerPhone(e164) || isPlayReviewStaffPhone(e164);
}

export function isPlayReviewAuthEnabled(): boolean {
  return Boolean(
    getPlayReviewOtp() &&
      (normalizeReviewPhone(env.PLAY_REVIEW_PHONE) ||
        normalizeReviewPhone(env.PLAY_REVIEW_STAFF_PHONE)),
  );
}

export function isPlayReviewCustomerAuthEnabled(): boolean {
  return Boolean(normalizeReviewPhone(env.PLAY_REVIEW_PHONE) && getPlayReviewOtp());
}

export function isPlayReviewStaffAuthEnabled(): boolean {
  return Boolean(normalizeReviewPhone(env.PLAY_REVIEW_STAFF_PHONE) && getPlayReviewOtp());
}

/** Comma-separated E.164 allowlist. When non-empty, only these phones may login. */
export function getLoginAllowlist(): string[] {
  const raw = env.AUTH_LOGIN_ALLOWLIST.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((part) => normalizeReviewPhone(part))
    .filter(Boolean);
}

export function isLoginAllowlistEnabled(): boolean {
  return getLoginAllowlist().length > 0;
}

export function isPhoneAllowedForLogin(e164: string): boolean {
  const allowlist = getLoginAllowlist();
  if (allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(normalizeReviewPhone(e164));
}

export function assertPhoneAllowedForLogin(e164: string): void {
  if (!isPhoneAllowedForLogin(e164)) {
    throw new AppError(
      403,
      AUTH_ERROR_CODES.LOGIN_RESTRICTED,
      'Access to this app is currently restricted.',
    );
  }
}
