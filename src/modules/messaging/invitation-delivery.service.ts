import { env } from '../../config/env.js';

export type GuestInvitationMessageParams = {
  guestPhone: string;
  guestName: string;
  inviterName: string;
  eventTitle: string;
  claimUrl: string;
};

function normalizeE164(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, '').replace(/[\s\r\n]+/g, '');
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function buildInvitationBody(params: GuestInvitationMessageParams): string {
  return [
    `Hola ${params.guestName}!`,
    `${params.inviterName} te invitó a ${params.eventTitle} en YouPass.`,
    '',
    'Para descargar la app y reclamar tu entrada:',
    `1. Abre este enlace: ${params.claimUrl}`,
    '2. Instala YouPass si aún no la tienes',
    '3. Ingresa tu número de teléfono y acepta la invitación',
    '',
    '— YouPass',
  ].join('\n');
}

export interface InvitationDeliveryService {
  sendGuestInvitation(params: GuestInvitationMessageParams): Promise<void>;
}

class MockInvitationDeliveryService implements InvitationDeliveryService {
  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<void> {
    const body = buildInvitationBody(params);
    console.log(
      `[Twilio MOCK/whatsapp-invite] → ${params.guestPhone} | inviter=${params.inviterName} | event=${params.eventTitle}`,
    );
    console.log(body);
  }
}

class TwilioInvitationDeliveryService implements InvitationDeliveryService {
  private getFromAddress(): string {
    const from = normalizeE164(env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''));
    if (!from) {
      throw new Error('TWILIO_WHATSAPP_FROM is not set');
    }
    return `whatsapp:${from}`;
  }

  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<void> {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials missing: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }

    const to = `whatsapp:${normalizeE164(params.guestPhone)}`;
    const from = this.getFromAddress();
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

    const form = new URLSearchParams({ To: to, From: from });

    if (env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID) {
      form.set('ContentSid', env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID);
      form.set(
        'ContentVariables',
        JSON.stringify({
          '1': params.guestName,
          '2': params.inviterName,
          '3': params.eventTitle,
          '4': params.claimUrl,
        }),
      );
    } else {
      form.set('Body', buildInvitationBody(params));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio invitation send failed: ${response.status} ${errorBody}`);
    }
  }
}

export function isInvitationDeliveryMock(): boolean {
  return env.TWILIO_MOCK;
}

export function invitationDeliveryMeta() {
  return {
    delivery_mode: env.TWILIO_MOCK ? ('mock' as const) : ('live' as const),
    whatsapp_sent: !env.TWILIO_MOCK,
  };
}

export const invitationDeliveryService: InvitationDeliveryService = env.TWILIO_MOCK
  ? new MockInvitationDeliveryService()
  : new TwilioInvitationDeliveryService();

export function buildClaimUrl(claimToken: string): string {
  const base = env.APP_CLAIM_BASE_URL.replace(/\/$/, '');
  return `${base}/${claimToken}`;
}
