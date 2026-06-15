import { env } from '../../config/env.js';

let cachedApprovedOtpContentSid: string | null | undefined;

function twilioAuthHeader(): string {
  return Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
}

function isApprovedWhatsAppTemplate(item: Record<string, unknown>): boolean {
  const approvals = item.approval_requests ?? item.approvals;
  if (approvals && typeof approvals === 'object') {
    const whatsapp = (approvals as Record<string, unknown>).whatsapp;
    if (whatsapp && typeof whatsapp === 'object') {
      const status = (whatsapp as Record<string, unknown>).status;
      if (status === 'approved') {
        return true;
      }
    }
  }

  const eligibility = item.channel_eligibility ?? item.channelEligibility;
  if (typeof eligibility === 'string' && eligibility.includes('whatsapp:approved')) {
    return true;
  }

  if (Array.isArray(eligibility)) {
    return eligibility.some(
      (entry) =>
        typeof entry === 'string' &&
        (entry.includes('whatsapp:approved') || entry.includes('"whatsapp":"approved"')),
    );
  }

  return false;
}

function isOtpTemplate(item: Record<string, unknown>): boolean {
  const types = item.types;
  if (types && typeof types === 'object') {
    const typeMap = types as Record<string, unknown>;
    if (typeMap['whatsapp/authentication']) {
      return true;
    }
  }

  const friendlyName = String(item.friendly_name ?? item.friendlyName ?? '').toLowerCase();
  return (
    friendlyName.includes('otp') ||
    friendlyName.includes('auth') ||
    friendlyName.includes('verification') ||
    friendlyName.includes('login') ||
    friendlyName.includes('youpass')
  );
}

/**
 * Finds the first approved WhatsApp OTP/authentication Content SID (HX...) in Twilio.
 * Used when TWILIO_WHATSAPP_OTP_CONTENT_SID is not set in env.
 */
export async function discoverApprovedOtpContentSid(): Promise<string | null> {
  if (cachedApprovedOtpContentSid !== undefined) {
    return cachedApprovedOtpContentSid;
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    cachedApprovedOtpContentSid = null;
    return null;
  }

  const headers = { Authorization: `Basic ${twilioAuthHeader()}` };
  const urls = [
    'https://content.twilio.com/v2/ContentAndApprovals?PageSize=50&ChannelEligibility=whatsapp:approved',
    'https://content.twilio.com/v1/Content?PageSize=50',
  ];

  try {
    for (const url of urls) {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        contents?: Record<string, unknown>[];
        content?: Record<string, unknown>[];
      };

      const items = data.contents ?? data.content ?? [];
      const otpApproved = items.find(
        (item) => isApprovedWhatsAppTemplate(item) && isOtpTemplate(item),
      );
      const firstApproved = items.find((item) => isApprovedWhatsAppTemplate(item));
      const firstOtp = items.find((item) => isOtpTemplate(item));
      const picked = otpApproved ?? firstApproved ?? firstOtp;

      if (picked) {
        const sid = String(picked.sid ?? picked.content_sid ?? '');
        if (sid.startsWith('HX')) {
          cachedApprovedOtpContentSid = sid;
          console.log(`[Twilio Content] Auto-selected OTP template SID: ${sid}`);
          return sid;
        }
      }
    }
  } catch (error) {
    console.error('[Twilio Content] Template discovery failed:', error);
  }

  cachedApprovedOtpContentSid = null;
  return null;
}

export function resetOtpContentSidCacheForTests(): void {
  cachedApprovedOtpContentSid = undefined;
}
