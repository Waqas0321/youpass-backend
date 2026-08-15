import type { ProducerSession } from '../auth/session';

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  producer_id?: string;
  producer_name?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Design-only login until producer auth API exists.
 * Replace with: apiPost<LoginResponse>('/api/v1/producer/auth/login', payload)
 */
export async function loginProducer(payload: LoginPayload): Promise<
  { ok: true; session: ProducerSession } | { ok: false; error: string }
> {
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'invalid_email' };
  }

  if (password.length < 6) {
    return { ok: false, error: 'invalid_password' };
  }

  await new Promise((resolve) => window.setTimeout(resolve, 400));

  return {
    ok: true,
    session: {
      email,
      token: `demo-${Date.now()}`,
      producerName: email.split('@')[0],
    },
  };
}
