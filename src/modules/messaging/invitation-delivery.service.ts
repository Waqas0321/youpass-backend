import { env } from '../../config/env.js';
import {
  isWhatsAppSandboxSender,
  pollTwilioMessageDelivery,
  sendAndConfirmWhatsApp,
  sendTwilioWhatsApp,
  useLiveTwilioWhatsApp,
} from './twilio-whatsapp.service.js';

export type GuestInvitationMessageParams = {
  guestPhone: string;
  guestName: string;
  inviterName: string;
  eventTitle: string;
  claimUrl: string;
};

export type GuestInvitationSendResult = {
  delivery_mode: 'mock' | 'live';
  whatsapp_sent: boolean;
  twilio_message_sid?: string;
  twilio_status?: string;
  twilio_error_code?: number | null;
  delivery_note?: string;
  delivery_via?: 'production' | 'sandbox';
};

function buildInvitationBody(params: GuestInvitationMessageParams): string {
  return (
    `YouPass: ${params.inviterName} invited you to ${params.eventTitle}. ` +
    `Claim your ticket: ${params.claimUrl}`
  );
}

function invitationContentSid(): string | undefined {
  const invite = env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID.trim();
  if (invite) return invite;
  const otp = env.TWILIO_WHATSAPP_OTP_CONTENT_SID.trim();
  return otp || undefined;
}

function invitationContentVariables(params: GuestInvitationMessageParams): Record<string, string> {
  if (env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID.trim()) {
    return {
      '1': params.guestName,
      '2': params.inviterName,
      '3': params.eventTitle,
      '4': params.claimUrl,
    };
  }

  return {
    '1': buildInvitationBody(params),
  };
}

export interface InvitationDeliveryService {
  sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult>;
}

class MockInvitationDeliveryService implements InvitationDeliveryService {
  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult> {
    console.log(
      `[Twilio MOCK/whatsapp-invite] → ${params.guestPhone} | inviter=${params.inviterName} | event=${params.eventTitle}`,
    );
    console.log(buildInvitationBody(params));
    return { delivery_mode: 'mock', whatsapp_sent: false };
  }
}

class TwilioInvitationDeliveryService implements InvitationDeliveryService {
  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult> {
    const body = buildInvitationBody(params);
    const contentSid = invitationContentSid();

    let result;

    if (isWhatsAppSandboxSender()) {
      const queued = await sendTwilioWhatsApp({ toE164: params.guestPhone, body });
      const delivered = await pollTwilioMessageDelivery(queued.sid);
      result = { ...queued, status: delivered.status ?? queued.status, delivery_via: 'sandbox' as const };
    } else if (contentSid) {
      result = await sendAndConfirmWhatsApp({
        toE164: params.guestPhone,
        contentSid,
        contentVariables: invitationContentVariables(params),
        fallbackBody: body,
      });
    } else {
      result = await sendAndConfirmWhatsApp({
        toE164: params.guestPhone,
        body,
        fallbackBody: body,
      });
    }

    return {
      delivery_mode: 'live',
      whatsapp_sent: result.status === 'delivered' || result.status === 'sent',
      twilio_message_sid: result.sid,
      twilio_status: result.status,
      twilio_error_code: result.error_code ?? null,
      delivery_via: result.delivery_via,
      delivery_note:
        result.delivery_via === 'sandbox'
          ? 'Delivered via Twilio sandbox — guest must have joined sandbox'
          : result.status === 'delivered'
            ? 'Delivered to WhatsApp'
            : 'Accepted by Twilio',
    };
  }
}

export function invitationDeliveryMeta(
  sendResult?: GuestInvitationSendResult,
): GuestInvitationSendResult {
  if (sendResult) return sendResult;
  return {
    delivery_mode: useLiveTwilioWhatsApp() ? 'live' : 'mock',
    whatsapp_sent: useLiveTwilioWhatsApp(),
  };
}

export const invitationDeliveryService: InvitationDeliveryService = useLiveTwilioWhatsApp()
  ? new TwilioInvitationDeliveryService()
  : new MockInvitationDeliveryService();

export function buildClaimUrl(claimToken: string): string {
  const base = env.APP_CLAIM_BASE_URL.replace(/\/$/, '');
  return `${base}/${claimToken}`;
}
