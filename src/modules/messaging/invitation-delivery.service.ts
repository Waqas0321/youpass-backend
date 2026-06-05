import { env } from '../../config/env.js';
import {
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
};

/** Compact single-line body — same style as OTP (sandbox-friendly). */
function buildInvitationBody(params: GuestInvitationMessageParams): string {
  return (
    `YouPass: ${params.inviterName} invited you to ${params.eventTitle}. ` +
    `Claim your ticket: ${params.claimUrl}`
  );
}

function buildInvitationBodyLong(params: GuestInvitationMessageParams): string {
  return [
    `Hola ${params.guestName}!`,
    `${params.inviterName} te invitó a ${params.eventTitle} en YouPass.`,
    `Claim: ${params.claimUrl}`,
  ].join(' ');
}

export interface InvitationDeliveryService {
  sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult>;
}

class MockInvitationDeliveryService implements InvitationDeliveryService {
  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult> {
    const body = buildInvitationBody(params);
    console.log(
      `[Twilio MOCK/whatsapp-invite] → ${params.guestPhone} | inviter=${params.inviterName} | event=${params.eventTitle}`,
    );
    console.log(body);
    return { delivery_mode: 'mock', whatsapp_sent: false };
  }
}

class TwilioInvitationDeliveryService implements InvitationDeliveryService {
  async sendGuestInvitation(params: GuestInvitationMessageParams): Promise<GuestInvitationSendResult> {
    const contentSid =
      env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID || env.TWILIO_WHATSAPP_OTP_CONTENT_SID;

    let result;

    if (contentSid) {
      result = await sendTwilioWhatsApp({
        toE164: params.guestPhone,
        contentSid,
        contentVariables: env.TWILIO_WHATSAPP_INVITATION_CONTENT_SID
          ? {
              '1': params.guestName,
              '2': params.inviterName,
              '3': params.eventTitle,
              '4': params.claimUrl,
            }
          : {
              '1': buildInvitationBody(params),
            },
      });
    } else {
      // Identical delivery mechanism as OTP — plain Body on WhatsApp.
      try {
        result = await sendTwilioWhatsApp({
          toE164: params.guestPhone,
          body: buildInvitationBody(params),
        });
      } catch (firstErr) {
        console.warn('[WhatsApp invite] compact body failed, retrying long body', firstErr);
        result = await sendTwilioWhatsApp({
          toE164: params.guestPhone,
          body: buildInvitationBodyLong(params),
        });
      }
    }

    return {
      delivery_mode: 'live',
      whatsapp_sent: true,
      twilio_message_sid: result.sid,
      twilio_status: result.status,
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
