import type { AuthCodePurpose } from '@prisma/client';
import { env } from '../../config/env.js';
import { OTP_PURPOSE_LABELS } from '../../config/constants.js';
import { SUPPORT_EMAIL } from '../../common/constants/auth-messages.js';
import {
  assertProductionOtpTemplateConfigured,
  resolveOtpContentSid,
} from '../../config/twilio-whatsapp.config.js';
import { buildWhatsAppOtpBody } from '../../common/constants/whatsapp-templates.js';
import {
  isWhatsAppSandboxSender,
  sendAndConfirmWhatsApp,
  sendTwilioWhatsApp,
  pollTwilioMessageDelivery,
} from '../messaging/twilio-whatsapp.service.js';

export type OtpDeliveryChannel = 'whatsapp';

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

class MockOtpDeliveryService implements OtpDeliveryService {
  getChannel(): OtpDeliveryChannel {
    return 'whatsapp';
  }

  async sendOtp(params: OtpSendParams): Promise<void> {
    const label = OTP_PURPOSE_LABELS[params.purpose];
    const body = buildWhatsAppOtpBody(params.purpose, params.code, params.languageCode);
    console.log(
      `[Twilio MOCK/whatsapp] → ${params.phone} | ${label} | code=${params.code} | body="${body}"`,
    );
  }

  async checkWhatsAppAvailable(_phone: string): Promise<boolean> {
    return true;
  }
}

class TwilioWhatsAppOtpService implements OtpDeliveryService {
  getChannel(): OtpDeliveryChannel {
    return 'whatsapp';
  }

  async sendOtp(params: OtpSendParams): Promise<void> {
    const body = buildWhatsAppOtpBody(params.purpose, params.code, params.languageCode);
    await assertProductionOtpTemplateConfigured(params.purpose);
    const contentSid = await resolveOtpContentSid(params.purpose);

    if (isWhatsAppSandboxSender()) {
      const queued = await sendTwilioWhatsApp({ toE164: params.phone, body });
      await pollTwilioMessageDelivery(queued.sid);
      return;
    }

    if (contentSid) {
      await sendAndConfirmWhatsApp({
        toE164: params.phone,
        contentSid,
        contentVariables: { '1': params.code },
        fallbackBody: body,
      });
      return;
    }

    await sendAndConfirmWhatsApp({
      toE164: params.phone,
      body,
      fallbackBody: body,
    });
  }

  async checkWhatsAppAvailable(phone: string): Promise<boolean> {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      return true;
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
  ? new MockOtpDeliveryService()
  : new TwilioWhatsAppOtpService();

export function whatsAppUnavailableMessage(languageCode = 'es'): string {
  switch (languageCode) {
    case 'pt':
      return `Este número não pode receber WhatsApp. O YouPass usa apenas WhatsApp Business para login — use um número com WhatsApp ativo. Precisa de ajuda? ${SUPPORT_EMAIL}`;
    case 'en':
      return `This number cannot receive WhatsApp. YouPass uses WhatsApp Business only for sign-in — use a number with active WhatsApp. Need help? ${SUPPORT_EMAIL}`;
    default:
      return `Este número no puede recibir WhatsApp. YouPass usa solo WhatsApp Business para iniciar sesión — usa un número con WhatsApp activo. ¿Necesitas ayuda? ${SUPPORT_EMAIL}`;
  }
}

export function whatsAppReadyMessage(languageCode = 'es'): string {
  switch (languageCode) {
    case 'pt':
      return 'Enviaremos seu código de verificação pelo WhatsApp Business.';
    case 'en':
      return 'We will send your verification code via WhatsApp Business.';
    default:
      return 'Te enviaremos tu código de verificación por WhatsApp Business.';
  }
}
