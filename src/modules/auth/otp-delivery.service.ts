import { env } from '../../config/env.js';
import type { AuthCodePurpose } from '@prisma/client';
import { OTP_PURPOSE_LABELS } from '../../config/constants.js';
import {
  normalizeE164,
  sendTwilioWhatsApp,
} from '../messaging/twilio-whatsapp.service.js';

export type OtpDeliveryChannel = 'sms' | 'whatsapp';

export type OtpSendParams = {
  phone: string;
  purpose: AuthCodePurpose;
  code: string;
  languageCode?: string;
};

export interface OtpDeliveryService {
  getChannel(): OtpDeliveryChannel;
  sendOtp(params: OtpSendParams): Promise<void>;
  checkWhatsAppAvailable(phone: string): Promise<boolean>;
}

function buildOtpMessage(purpose: AuthCodePurpose, code: string): string {
  const messages: Record<AuthCodePurpose, string> = {
    register: `Your YouPass verification code is ${code}. Valid for 3 minutes.`,
    login: `Your YouPass login code is ${code}. Valid for 3 minutes.`,
    change_phone: `Your YouPass phone change code is ${code}. Valid for 3 minutes.`,
    delete_account: `Your YouPass account deletion code is ${code}. Valid for 3 minutes.`,
  };
  return messages[purpose];
}

function normalizeE164Phone(value: string): string {
  return normalizeE164(value);
}

class MockOtpDeliveryService implements OtpDeliveryService {
  constructor(private readonly channel: OtpDeliveryChannel) {}

  getChannel(): OtpDeliveryChannel {
    return this.channel;
  }

  async sendOtp(params: OtpSendParams): Promise<void> {
    const label = OTP_PURPOSE_LABELS[params.purpose];
    const body = buildOtpMessage(params.purpose, params.code);
    console.log(
      `[Twilio MOCK/${this.channel}] → ${params.phone} | ${label} | code=${params.code} | body="${body}"`,
    );
  }

  async checkWhatsAppAvailable(_phone: string): Promise<boolean> {
    return this.channel === 'whatsapp';
  }
}

class TwilioOtpDeliveryService implements OtpDeliveryService {
  constructor(private readonly channel: OtpDeliveryChannel) {}

  getChannel(): OtpDeliveryChannel {
    return this.channel;
  }

  private getFromAddress(): string {
    if (this.channel === 'whatsapp') {
      const from = normalizeE164Phone(env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''));
      if (!from) {
        throw new Error(
          'TWILIO_WHATSAPP_FROM is not set. Use your Twilio WhatsApp sandbox number, e.g. +14155238886',
        );
      }
      return `whatsapp:${from}`;
    }
    const smsFrom = normalizeE164Phone(env.TWILIO_SMS_FROM);
    if (!smsFrom) {
      throw new Error('TWILIO_SMS_FROM is not set');
    }
    return smsFrom;
  }

  private getToAddress(phone: string): string {
    if (this.channel === 'whatsapp') {
      return `whatsapp:${phone}`;
    }
    return phone;
  }

  async sendOtp(params: OtpSendParams): Promise<void> {
    if (this.channel === 'whatsapp') {
      await sendTwilioWhatsApp({
        toE164: params.phone,
        body: buildOtpMessage(params.purpose, params.code),
      });
      return;
    }

    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials missing: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }

    const body = buildOtpMessage(params.purpose, params.code);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: this.getToAddress(params.phone),
        From: this.getFromAddress(),
        Body: body,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorBody}`);
    }
  }

  async checkWhatsAppAvailable(phone: string): Promise<boolean> {
    if (this.channel !== 'whatsapp') {
      return false;
    }

    try {
      const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`;
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!response.ok) return true;
      const data = (await response.json()) as {
        line_type_intelligence?: { type?: string };
      };
      const type = data.line_type_intelligence?.type?.toLowerCase();
      return !type || type === 'mobile' || type === 'nonfixedvoip';
    } catch {
      return true;
    }
  }
}

export const otpDeliveryService: OtpDeliveryService = env.TWILIO_MOCK
  ? new MockOtpDeliveryService(env.OTP_DELIVERY_CHANNEL)
  : new TwilioOtpDeliveryService(env.OTP_DELIVERY_CHANNEL);
