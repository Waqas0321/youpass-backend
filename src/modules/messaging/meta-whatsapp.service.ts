import { env } from '../../config/env.js';
import {
  hasMetaWhatsAppCredentials,
  metaGraphApiBaseUrl,
} from '../../config/meta-whatsapp.config.js';

export type MetaWhatsAppTemplateSendParams = {
  toE164: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: string[];
  /** Authentication OTP templates require body + copy_code button components. */
  authenticationOtpCode?: string;
};

export type MetaWhatsAppSendResult = {
  messageId: string;
  status?: string;
};

type MetaSendResponse = {
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

/** Strip + and spaces — Meta expects digits only (country code + national number). */
export function metaWhatsAppRecipientDigits(e164: string): string {
  return e164.replace(/\D/g, '');
}

export function hasMetaWhatsAppConfigured(): boolean {
  return !env.WHATSAPP_MOCK && hasMetaWhatsAppCredentials();
}

export async function sendMetaWhatsAppTemplate(
  params: MetaWhatsAppTemplateSendParams,
): Promise<MetaWhatsAppSendResult> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required');
  }

  const to = metaWhatsAppRecipientDigits(params.toE164);
  if (!to) {
    throw new Error('Invalid WhatsApp recipient phone number');
  }

  let components: Array<Record<string, unknown>> | undefined;
  if (params.authenticationOtpCode) {
    const code = params.authenticationOtpCode;
    components = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: code }],
      },
      {
        type: 'button',
        sub_type: 'copy_code',
        index: '0',
        parameters: [{ type: 'coupon_code', coupon_code: code }],
      },
    ];
  } else if (params.bodyParameters && params.bodyParameters.length > 0) {
    components = [
      {
        type: 'body',
        parameters: params.bodyParameters.map((text) => ({
          type: 'text',
          text,
        })),
      },
    ];
  }

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: params.languageCode },
      ...(components ? { components } : {}),
    },
  };

  const url = `${metaGraphApiBaseUrl()}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed: MetaSendResponse;
  try {
    parsed = JSON.parse(raw) as MetaSendResponse;
  } catch {
    throw new Error(`Meta WhatsApp API returned non-JSON: ${response.status} ${raw}`);
  }

  if (!response.ok || parsed.error) {
    const detail = parsed.error?.message ?? raw;
    const code = parsed.error?.code;
    throw new Error(
      code ? `Meta WhatsApp send failed (${code}): ${detail}` : `Meta WhatsApp send failed: ${detail}`,
    );
  }

  const messageId = parsed.messages?.[0]?.id;
  if (!messageId) {
    throw new Error(`Meta WhatsApp send returned no message id: ${raw}`);
  }

  return {
    messageId,
    status: parsed.messages?.[0]?.message_status,
  };
}

export async function sendMetaWhatsAppOtp(params: {
  toE164: string;
  templateName: string;
  languageCode: string;
  code: string;
}): Promise<MetaWhatsAppSendResult> {
  return sendMetaWhatsAppTemplate({
    toE164: params.toE164,
    templateName: params.templateName,
    languageCode: params.languageCode,
    authenticationOtpCode: params.code,
  });
}
