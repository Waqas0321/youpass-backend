import { env } from '../../config/env.js';
import { collectTwilioWhatsAppConfigIssues, isProductionWhatsAppMode } from '../../config/twilio-whatsapp.config.js';
import {
  discoverApprovedOtpContentSid,
  isApprovedWhatsAppTemplate,
  isWhatsAppAuthenticationTemplate,
  listWhatsAppContentTemplates,
} from './twilio-content-discovery.service.js';
import { isWhatsAppSandboxSender, normalizeE164 } from './twilio-whatsapp.service.js';

function twilioAuthHeader(): string {
  return Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
}

async function twilioFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${twilioAuthHeader()}`,
      ...(init?.headers ?? {}),
    },
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio ${url} failed: ${res.status} ${raw}`);
  }
  return raw ? JSON.parse(raw) : {};
}

export async function fetchWhatsAppSenders(): Promise<Record<string, unknown>[]> {
  const data = (await twilioFetchJson(
    'https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=20',
  )) as { senders?: Record<string, unknown>[] };
  return data.senders ?? [];
}

export async function fetchTemplateApprovalStatus(contentSid: string): Promise<Record<string, unknown>> {
  try {
    return (await twilioFetchJson(
      `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests`,
    )) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function submitOtpTemplateForWhatsAppApproval(
  contentSid: string,
  templateName = 'youpass_otp_login',
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${twilioAuthHeader()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: templateName,
        category: 'AUTHENTICATION',
      }),
    },
  );
  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!res.ok) {
    throw new Error(`Template approval submit failed: ${res.status} ${raw}`);
  }
  return data as Record<string, unknown>;
}

export async function getTwilioWhatsAppDiagnostics(phoneE164?: string) {
  const templates = await listWhatsAppContentTemplates();
  const discoveredOtpSid = await discoverApprovedOtpContentSid();
  const otpSid = env.TWILIO_WHATSAPP_OTP_CONTENT_SID || discoveredOtpSid || null;

  let senders: Record<string, unknown>[] = [];
  let otpTemplateApproval: Record<string, unknown> = {};
  try {
    senders = await fetchWhatsAppSenders();
  } catch (err) {
    senders = [{ error: err instanceof Error ? err.message : String(err) }];
  }

  if (otpSid) {
    otpTemplateApproval = await fetchTemplateApprovalStatus(otpSid);
  }

  const configuredFrom = normalizeE164(env.TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, ''));
  const matchingSender = senders.find((sender) => {
    const senderId = normalizeE164(String(sender.sender_id ?? '').replace(/^whatsapp:/, ''));
    return senderId === configuredFrom;
  });

  let recentMessages: Array<Record<string, unknown>> = [];
  if (phoneE164 && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json?PageSize=10&To=${encodeURIComponent(`whatsapp:${phoneE164}`)}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${twilioAuthHeader()}` } });
    if (res.ok) {
      const data = (await res.json()) as { messages?: Record<string, unknown>[] };
      recentMessages = (data.messages ?? []).map((msg) => ({
        sid: msg.sid,
        status: msg.status,
        from: msg.from,
        error_code: msg.error_code,
        error_message: msg.error_message,
        date_sent: msg.date_sent,
      }));
    }
  }

  const otpTemplate = templates.find((t) => t.sid === otpSid);
  const productionReady = Boolean(
    matchingSender &&
      String(matchingSender.status ?? '').toUpperCase() === 'ONLINE' &&
      otpTemplate?.approved &&
      otpTemplate?.is_authentication,
  );

  return {
    mode: env.TWILIO_MOCK
      ? 'mock'
      : isProductionWhatsAppMode()
        ? 'production'
        : isWhatsAppSandboxSender()
          ? 'sandbox'
          : 'incomplete',
    from: env.TWILIO_WHATSAPP_FROM,
    mock: env.TWILIO_MOCK,
    sandbox_fallback: env.TWILIO_WHATSAPP_SANDBOX_FALLBACK,
    configured_otp_content_sid: otpSid,
    discovered_otp_content_sid: discoveredOtpSid,
    production_ready: productionReady,
    sender: matchingSender ?? null,
    senders,
    otp_template: otpTemplate ?? null,
    otp_template_approval: otpTemplateApproval,
    config_issues: collectTwilioWhatsAppConfigIssues(),
    templates,
    recent_messages: recentMessages,
    blockers: [
      ...(matchingSender && String(matchingSender.status ?? '').toUpperCase() !== 'ONLINE'
        ? [`Sender ${configuredFrom} status is ${String(matchingSender.status ?? 'unknown')} — must be ONLINE`]
        : !matchingSender
          ? [`Sender ${configuredFrom} not found in Twilio WhatsApp senders list`]
          : []),
      ...(otpTemplate && !otpTemplate.approved
        ? [`OTP template ${otpSid} is not Meta-approved yet`]
        : []),
      ...(otpTemplate && !otpTemplate.is_authentication
        ? [`OTP template ${otpSid} is not whatsapp/authentication type`]
        : []),
    ],
  };
}

export { isApprovedWhatsAppTemplate, isWhatsAppAuthenticationTemplate };
