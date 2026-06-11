import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

type RecaptchaVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

export function isRecaptchaRequired(): boolean {
  return env.RECAPTCHA_ENABLED && Boolean(env.RECAPTCHA_SECRET_KEY);
}

export async function verifyRecaptchaToken(
  token: string | undefined,
  expectedAction?: string,
): Promise<void> {
  if (!isRecaptchaRequired()) {
    return;
  }

  if (!token?.trim()) {
    throw new AppError(
      400,
      'RECAPTCHA_REQUIRED',
      'Security verification required. Please complete reCAPTCHA and try again.',
    );
  }

  const params = new URLSearchParams({
    secret: env.RECAPTCHA_SECRET_KEY,
    response: token.trim(),
  });

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new AppError(502, 'RECAPTCHA_VERIFY_FAILED', 'Could not verify security check');
  }

  const data = (await response.json()) as RecaptchaVerifyResponse;

  if (!data.success) {
    throw new AppError(400, 'RECAPTCHA_FAILED', 'Security verification failed. Please try again.');
  }

  if (env.RECAPTCHA_MIN_SCORE > 0 && typeof data.score === 'number' && data.score < env.RECAPTCHA_MIN_SCORE) {
    throw new AppError(403, 'RECAPTCHA_FAILED', 'Security verification failed. Please try again.');
  }

  if (expectedAction && data.action && data.action !== expectedAction) {
    throw new AppError(400, 'RECAPTCHA_FAILED', 'Security verification failed. Please try again.');
  }
}
