import { env } from '../../config/env.js';

let cachedApprovedOtpContentSid: string | null | undefined;

function twilioAuthHeader(): string {
  return Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
}

export function isApprovedWhatsAppTemplate(item: Record<string, unknown>): boolean {
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

export function isWhatsAppAuthenticationTemplate(item: Record<string, unknown>): boolean {
  const types = item.types;
  if (types && typeof types === 'object') {
    return Boolean((types as Record<string, unknown>)['whatsapp/authentication']);
  }
  return false;
}

export type TwilioContentTemplateSummary = {
  sid: string;
  friendly_name: string;
  types: unknown;
  approved: boolean;
  is_authentication: boolean;
};

export async function listWhatsAppContentTemplates(): Promise<TwilioContentTemplateSummary[]> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return [];
  }

  const headers = { Authorization: `Basic ${twilioAuthHeader()}` };
  const urls = [
    'https://content.twilio.com/v2/ContentAndApprovals?PageSize=50&ChannelEligibility=whatsapp:approved',
    'https://content.twilio.com/v1/Content?PageSize=50',
  ];

  const seen = new Set<string>();
  const results: TwilioContentTemplateSummary[] = [];

  for (const url of urls) {
    const response = await fetch(url, { headers });
    if (!response.ok) continue;

    const data = (await response.json()) as {
      contents?: Record<string, unknown>[];
      content?: Record<string, unknown>[];
    };

    for (const item of data.contents ?? data.content ?? []) {
      const sid = String(item.sid ?? item.content_sid ?? '');
      if (!sid.startsWith('HX') || seen.has(sid)) continue;
      seen.add(sid);
      results.push({
        sid,
        friendly_name: String(item.friendly_name ?? item.friendlyName ?? ''),
        types: item.types,
        approved: isApprovedWhatsAppTemplate(item),
        is_authentication: isWhatsAppAuthenticationTemplate(item),
      });
    }
  }

  return results;
}

/**
 * Finds an approved WhatsApp Authentication (OTP) Content SID (HX...).
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

  try {
    const templates = await listWhatsAppContentTemplates();
    const authApproved = templates.find((item) => item.approved && item.is_authentication);

    if (authApproved) {
      cachedApprovedOtpContentSid = authApproved.sid;
      console.log(
        `[Twilio Content] Auto-selected OTP template SID: ${authApproved.sid} (${authApproved.friendly_name})`,
      );
      return authApproved.sid;
    }

    const approvedNames = templates
      .filter((item) => item.approved)
      .map((item) => `${item.sid} (${item.friendly_name})`)
      .join(', ');

    console.error(
      '[Twilio Content] No approved whatsapp/authentication template found.' +
        (approvedNames ? ` Approved non-auth templates: ${approvedNames}` : ' No approved templates at all.'),
    );
  } catch (error) {
    console.error('[Twilio Content] Template discovery failed:', error);
  }

  cachedApprovedOtpContentSid = null;
  return null;
}

export function resetOtpContentSidCacheForTests(): void {
  cachedApprovedOtpContentSid = undefined;
}
