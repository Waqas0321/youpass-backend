import { env } from '../../config/env.js';

export type TwilioWhatsAppSendParams = {
  toE164: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
};

export type TwilioWhatsAppSendResult = {
  sid: string;
  status: string;
};

export function normalizeE164(value: string): string {
  const trimmed = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\s\r\n]+/g, '');
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function hasTwilioWhatsAppCredentials(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_WHATSAPP_FROM,
  );
}

/** Live WhatsApp sends when mock is off and credentials exist (same gate as OTP). */
export function useLiveTwilioWhatsApp(): boolean {
  return !env.TWILIO_MOCK && hasTwilioWhatsAppCredentials();
}

function whatsappFromAddress(): string {
  const from = normalizeE164(env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''));
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_FROM is not set');
  }
  return `whatsapp:${from}`;
}

function whatsappToAddress(e164: string): string {
  return `whatsapp:${normalizeE164(e164)}`;
}

export async function sendTwilioWhatsApp(
  params: TwilioWhatsAppSendParams,
): Promise<TwilioWhatsAppSendResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials missing: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

  const form = new URLSearchParams({
    To: whatsappToAddress(params.toE164),
    From: whatsappFromAddress(),
  });

  if (params.contentSid) {
    form.set('ContentSid', params.contentSid);
    if (params.contentVariables) {
      form.set('ContentVariables', JSON.stringify(params.contentVariables));
    }
  } else if (params.body) {
    // Same free-form Body path used by OTP WhatsApp delivery.
    form.set('Body', params.body);
  } else {
    throw new Error('Twilio WhatsApp message requires body or contentSid');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const raw = await response.text();
  let data: { sid?: string; status?: string; message?: string; code?: number } = {};
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    // non-json error body
  }

  if (!response.ok) {
    throw new Error(
      `Twilio WhatsApp error: ${response.status} ${data.message ?? raw}`.trim(),
    );
  }

  if (data.status === 'failed' || data.status === 'undelivered') {
    throw new Error(`Twilio WhatsApp message ${data.status}: ${data.message ?? data.sid ?? 'unknown'}`);
  }

  return {
    sid: data.sid ?? 'unknown',
    status: data.status ?? 'queued',
  };
}
