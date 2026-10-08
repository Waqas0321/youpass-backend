import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Meta Cloud API webhook verification (GET).
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
export function verifyMetaWhatsAppWebhook(query: {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}): { ok: true; challenge: string } | { ok: false; status: number; error: string } {
  const mode = String(query['hub.mode'] ?? '');
  const token = String(query['hub.verify_token'] ?? '');
  const challenge = String(query['hub.challenge'] ?? '');
  const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured on the server',
    };
  }

  if (mode !== 'subscribe' || !challenge) {
    return { ok: false, status: 400, error: 'Invalid webhook verification request' };
  }

  if (token !== expected) {
    return { ok: false, status: 403, error: 'Verify token mismatch' };
  }

  return { ok: true, challenge };
}

/** Optional X-Hub-Signature-256 check when WHATSAPP_APP_SECRET is set. */
export function isValidMetaWhatsAppSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
): boolean {
  const secret = env.WHATSAPP_APP_SECRET;
  if (!secret) {
    return true;
  }
  if (!rawBody || !signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expectedHex = signatureHeader.slice('sha256='.length);
  const raw = typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody;
  const digest = createHmac('sha256', secret).update(raw).digest('hex');

  try {
    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        statuses?: Array<{ id?: string; status?: string; timestamp?: string; errors?: unknown[] }>;
        messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string }>;
      };
    }>;
  }>;
};

/** Acknowledge inbound webhooks; log delivery statuses for ops (OTP debug). */
export function handleMetaWhatsAppWebhookPayload(body: unknown): void {
  const payload = body as MetaWebhookPayload;
  if (payload?.object !== 'whatsapp_business_account') {
    return;
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field ?? '(unknown)';
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (value?.statuses?.length) {
        for (const status of value.statuses) {
          console.log(
            `[Meta WhatsApp webhook] field=${field} phone_number_id=${phoneNumberId ?? '-'} message=${status.id ?? '-'} status=${status.status ?? '-'}`,
          );
          if (status.errors?.length) {
            console.warn('[Meta WhatsApp webhook] status errors:', JSON.stringify(status.errors));
          }
        }
      }

      if (value?.messages?.length) {
        for (const message of value.messages) {
          console.log(
            `[Meta WhatsApp webhook] inbound field=${field} from=${message.from ?? '-'} type=${message.type ?? '-'} id=${message.id ?? '-'}`,
          );
        }
      }
    }
  }
}
