import { env } from '../../config/env.js';
import type { AuthCodePurpose } from '@prisma/client';
import { WHATSAPP_TEMPLATES } from '../../config/constants.js';

export type WhatsAppSendParams = {
  phone: string;
  purpose: AuthCodePurpose;
  code: string;
  languageCode?: string;
};

export interface WhatsAppService {
  sendOtp(params: WhatsAppSendParams): Promise<void>;
  checkWhatsAppAvailable(phone: string): Promise<boolean>;
}

class MockWhatsAppService implements WhatsAppService {
  async sendOtp(params: WhatsAppSendParams): Promise<void> {
    const template = WHATSAPP_TEMPLATES[params.purpose];
    console.log(
      `[WhatsApp MOCK] → ${params.phone} | template=${template} | code=${params.code} | lang=${params.languageCode ?? 'es'}`,
    );
  }

  async checkWhatsAppAvailable(_phone: string): Promise<boolean> {
    return true;
  }
}

class MetaWhatsAppService implements WhatsAppService {
  async sendOtp(params: WhatsAppSendParams): Promise<void> {
    const template = WHATSAPP_TEMPLATES[params.purpose];
    const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.phone.replace('+', ''),
        type: 'template',
        template: {
          name: template,
          language: { code: params.languageCode ?? 'es' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: params.code }],
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${body}`);
    }
  }

  async checkWhatsAppAvailable(phone: string): Promise<boolean> {
    try {
      const url = `${env.WHATSAPP_API_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/contacts`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blocking: 'wait',
          contacts: [phone.replace('+', '')],
        }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { contacts?: Array<{ status?: string }> };
      return data.contacts?.[0]?.status === 'valid';
    } catch {
      return false;
    }
  }
}

export const whatsappService: WhatsAppService = env.WHATSAPP_MOCK
  ? new MockWhatsAppService()
  : new MetaWhatsAppService();
