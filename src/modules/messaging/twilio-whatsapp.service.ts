import { env } from '../../config/env.js';

export type TwilioWhatsAppSendParams = {
  toE164: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  /** Override sender E.164 (e.g. sandbox fallback). */
  fromE164?: string;
};

export type TwilioWhatsAppSendResult = {
  sid: string;
  status: string;
  error_code?: number | null;
  error_message?: string | null;
  delivery_via?: 'production' | 'sandbox';
};

type TwilioMessageRecord = {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  to?: string;
  from?: string;
};

const TERMINAL_STATUSES = new Set(['delivered', 'sent', 'failed', 'undelivered', 'canceled']);
const SANDBOX_NUMBER = '+14155238886';

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

export function sandboxWhatsAppFrom(): string | undefined {
  const configured = normalizeE164(env.TWILIO_WHATSAPP_SANDBOX_FROM.replace(/^whatsapp:/, ''));
  return configured || SANDBOX_NUMBER;
}

/** Twilio sandbox sender — free-form Body works for numbers that joined the sandbox. */
export function isWhatsAppSandboxSender(fromE164?: string): boolean {
  const from = normalizeE164((fromE164 ?? env.TWILIO_WHATSAPP_FROM).replace(/^whatsapp:/, ''));
  return from === SANDBOX_NUMBER;
}

function twilioAuthHeader(): string {
  return Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
}

function whatsappFromAddress(fromE164?: string): string {
  const raw = fromE164 ?? env.TWILIO_WHATSAPP_FROM;
  const from = normalizeE164(raw.replace(/^whatsapp:/, ''));
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_FROM is not set');
  }
  return `whatsapp:${from}`;
}

function whatsappToAddress(e164: string): string {
  return `whatsapp:${normalizeE164(e164)}`;
}

export async function fetchTwilioMessageStatus(messageSid: string): Promise<TwilioMessageRecord> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${messageSid}.json`;
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${twilioAuthHeader()}` },
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Twilio status check failed: ${response.status} ${raw}`);
  }
  return JSON.parse(raw) as TwilioMessageRecord;
}

export function explainTwilioWhatsAppFailure(record: TwilioMessageRecord): string {
  const code = record.error_code;
  if (code === 63016) {
    return (
      'WhatsApp requires an approved message template on the production sender. ' +
      'Until Meta approves templates, the guest must join the Twilio sandbox from their phone.'
    );
  }
  if (code === 63015 || code === 21608 || code === 21408) {
    return (
      'This phone has not joined the Twilio WhatsApp sandbox. ' +
      'Open WhatsApp, send join <your-sandbox-code> to +1 415 523 8886, then try again.'
    );
  }
  if (code === 21211) {
    return 'Invalid phone number for WhatsApp delivery.';
  }
  return record.error_message ?? `WhatsApp delivery failed (code ${code ?? 'unknown'})`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until delivered/failed or timeout — queued alone is not success. */
export async function pollTwilioMessageDelivery(
  messageSid: string,
  maxAttempts = 6,
  intervalMs = 1500,
): Promise<TwilioMessageRecord> {
  let last: TwilioMessageRecord = { sid: messageSid, status: 'queued' };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    last = await fetchTwilioMessageStatus(messageSid);

    if (last.status === 'failed' || last.status === 'undelivered' || last.status === 'canceled') {
      throw new Error(explainTwilioWhatsAppFailure(last));
    }

    if (last.status === 'delivered' || last.status === 'sent') {
      return last;
    }

    if (last.status && TERMINAL_STATUSES.has(last.status) && last.status !== 'queued') {
      return last;
    }
  }

  if (last.status === 'queued') {
    throw new Error(
      'WhatsApp message was not delivered. Production needs approved templates; ' +
        'sandbox requires the recipient to send join <code> to +1 415 523 8886.',
    );
  }

  return last;
}

export async function sendTwilioWhatsApp(
  params: TwilioWhatsAppSendParams,
): Promise<TwilioWhatsAppSendResult> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials missing: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const form = new URLSearchParams({
    To: whatsappToAddress(params.toE164),
    From: whatsappFromAddress(params.fromE164),
  });

  if (params.contentSid) {
    form.set('ContentSid', params.contentSid);
    if (params.contentVariables) {
      form.set('ContentVariables', JSON.stringify(params.contentVariables));
    }
  } else if (params.body) {
    form.set('Body', params.body);
  } else {
    throw new Error('Twilio WhatsApp message requires body or contentSid');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${twilioAuthHeader()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const raw = await response.text();
  let data: TwilioMessageRecord = {};
  try {
    data = JSON.parse(raw) as TwilioMessageRecord;
  } catch {
    // non-json error body
  }

  if (!response.ok) {
    throw new Error(`Twilio WhatsApp error: ${response.status} ${data.error_message ?? raw}`.trim());
  }

  if (data.status === 'failed' || data.status === 'undelivered') {
    throw new Error(explainTwilioWhatsAppFailure(data));
  }

  const via = isWhatsAppSandboxSender(params.fromE164) ? 'sandbox' : 'production';

  return {
    sid: data.sid ?? 'unknown',
    status: data.status ?? 'queued',
    error_code: data.error_code ?? null,
    error_message: data.error_message ?? null,
    delivery_via: via,
  };
}

/** Try production/template first; on failure retry plain body via sandbox sender. */
export async function sendAndConfirmWhatsApp(
  params: TwilioWhatsAppSendParams & { fallbackBody: string },
): Promise<TwilioWhatsAppSendResult> {
  const sandboxFrom = sandboxWhatsAppFrom();
  const canFallback =
    env.NODE_ENV !== 'production' &&
    sandboxFrom &&
    !isWhatsAppSandboxSender(params.fromE164) &&
    normalizeE164(params.fromE164 ?? env.TWILIO_WHATSAPP_FROM) !== sandboxFrom;

  try {
    const queued = await sendTwilioWhatsApp(params);
    const delivered = await pollTwilioMessageDelivery(queued.sid);
    return {
      ...queued,
      status: delivered.status ?? queued.status,
      delivery_via: queued.delivery_via,
    };
  } catch (primaryErr) {
    if (!canFallback) throw primaryErr;

    console.warn(
      '[WhatsApp] primary send failed, retrying via sandbox',
      primaryErr instanceof Error ? primaryErr.message : primaryErr,
    );

    const queued = await sendTwilioWhatsApp({
      toE164: params.toE164,
      body: params.fallbackBody,
      fromE164: sandboxFrom,
    });
    const delivered = await pollTwilioMessageDelivery(queued.sid);
    return {
      ...queued,
      status: delivered.status ?? queued.status,
      delivery_via: 'sandbox',
    };
  }
}
