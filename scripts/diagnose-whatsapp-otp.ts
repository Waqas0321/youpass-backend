/**
 * Diagnose Twilio WhatsApp OTP delivery for production sender + templates.
 * Run: DOTENV_CONFIG_PATH=.env.vercel.production npx tsx scripts/diagnose-whatsapp-otp.ts [e164]
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

const envPath = process.env.DOTENV_CONFIG_PATH ?? resolve(process.cwd(), '.env.vercel.production');
config({ path: envPath });

const TWILIO_ACCOUNT_SID = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
const TWILIO_AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();
const TWILIO_WHATSAPP_FROM = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim();
const TWILIO_WHATSAPP_OTP_CONTENT_SID = (process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID ?? '').trim();
const TWILIO_MOCK = process.env.TWILIO_MOCK === 'true' || process.env.TWILIO_MOCK === '1';

const testPhone = process.argv[2] ?? '+923216548001';
const SANDBOX_NUMBER = '+14155238886';

function twilioAuthHeader(): string {
  return Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
}

function isApprovedWhatsAppTemplate(item: Record<string, unknown>): boolean {
  const approvals = item.approval_requests ?? item.approvals;
  if (approvals && typeof approvals === 'object') {
    const whatsapp = (approvals as Record<string, unknown>).whatsapp;
    if (whatsapp && typeof whatsapp === 'object') {
      const status = (whatsapp as Record<string, unknown>).status;
      if (status === 'approved') return true;
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

function isAuthOtpTemplate(item: Record<string, unknown>): boolean {
  const types = item.types;
  if (types && typeof types === 'object') {
    return Boolean((types as Record<string, unknown>)['whatsapp/authentication']);
  }
  return false;
}

async function discoverApprovedOtpContentSid(): Promise<string | null> {
  const headers = { Authorization: `Basic ${twilioAuthHeader()}` };
  const urls = [
    'https://content.twilio.com/v2/ContentAndApprovals?PageSize=50&ChannelEligibility=whatsapp:approved',
    'https://content.twilio.com/v1/Content?PageSize=50',
  ];

  for (const url of urls) {
    const response = await fetch(url, { headers });
    if (!response.ok) continue;

    const data = (await response.json()) as {
      contents?: Record<string, unknown>[];
      content?: Record<string, unknown>[];
    };

    const items = data.contents ?? data.content ?? [];
    const authApproved = items.find(
      (item) => isApprovedWhatsAppTemplate(item) && isAuthOtpTemplate(item),
    );

    if (authApproved) {
      const sid = String(authApproved.sid ?? authApproved.content_sid ?? '');
      if (sid.startsWith('HX')) return sid;
    }
  }

  return null;
}

async function listContentTemplates(): Promise<void> {
  const headers = { Authorization: `Basic ${twilioAuthHeader()}` };

  console.log('\n=== Content templates (v2 approved) ===');
  const v2 = await fetch(
    'https://content.twilio.com/v2/ContentAndApprovals?PageSize=20&ChannelEligibility=whatsapp:approved',
    { headers },
  );
  console.log('v2 status:', v2.status);
  if (v2.ok) {
    const data = (await v2.json()) as { contents?: Record<string, unknown>[] };
    for (const item of data.contents ?? []) {
      const auth = isAuthOtpTemplate(item);
      const approved = isApprovedWhatsAppTemplate(item);
      console.log(
        `- ${item.sid} | ${item.friendly_name} | auth=${auth} approved=${approved} | types=${JSON.stringify(item.types)}`,
      );
    }
  } else {
    console.log(await v2.text());
  }

  console.log('\n=== Content templates (v1 all) ===');
  const v1 = await fetch('https://content.twilio.com/v1/Content?PageSize=20', { headers });
  console.log('v1 status:', v1.status);
  if (v1.ok) {
    const data = (await v1.json()) as { contents?: Record<string, unknown>[] };
    for (const item of data.contents ?? []) {
      console.log(`- ${item.sid} | ${item.friendly_name} | types=${JSON.stringify(item.types)}`);
    }
  }
}

async function listRecentMessages(): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json?PageSize=10&To=${encodeURIComponent(`whatsapp:${testPhone}`)}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${twilioAuthHeader()}` } });
  console.log('\n=== Recent messages to', testPhone, '===');
  if (!res.ok) {
    console.log('fetch failed', res.status, await res.text());
    return;
  }
  const data = (await res.json()) as {
    messages?: Array<{
      sid: string;
      status: string;
      from: string;
      to: string;
      error_code?: number;
      error_message?: string;
      date_sent?: string;
    }>;
  };
  for (const msg of data.messages ?? []) {
    console.log(
      `- ${msg.sid} | ${msg.status} | from=${msg.from} | error=${msg.error_code ?? '-'} ${msg.error_message ?? ''} | sent=${msg.date_sent ?? '-'}`,
    );
  }
}

async function fetchMessageStatus(messageSid: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${messageSid}.json`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${twilioAuthHeader()}` } });
  return (await res.json()) as {
    status?: string;
    error_code?: number;
    error_message?: string;
  };
}

async function sendTest(contentSid: string, code: string) {
  const form = new URLSearchParams({
    To: `whatsapp:${testPhone}`,
    From: `whatsapp:${TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, '')}`,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify({ '1': code }),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${twilioAuthHeader()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
  );

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`send failed ${res.status}: ${raw}`);
  }
  return JSON.parse(raw) as { sid: string; status: string };
}

async function testSend(): Promise<void> {
  const contentSid = TWILIO_WHATSAPP_OTP_CONTENT_SID || (await discoverApprovedOtpContentSid());
  console.log('\n=== Config ===');
  console.log('env file:', envPath);
  console.log('TWILIO_MOCK:', TWILIO_MOCK);
  console.log('TWILIO_WHATSAPP_FROM:', TWILIO_WHATSAPP_FROM);
  console.log('sandbox sender?', TWILIO_WHATSAPP_FROM.replace(/^whatsapp:/, '') === SANDBOX_NUMBER);
  console.log('discovered OTP content SID:', contentSid);
  console.log('env OTP content SID:', TWILIO_WHATSAPP_OTP_CONTENT_SID || '(empty)');

  if (!contentSid) {
    console.error('\nNo approved whatsapp/authentication template found.');
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.log('\n=== Test send OTP', code, 'to', testPhone, '===');

  const queued = await sendTest(contentSid, code);
  console.log('queued:', queued);

  for (let i = 0; i < 15; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await fetchMessageStatus(queued.sid);
    console.log(
      `poll ${i + 1}: status=${status.status} error=${status.error_code ?? '-'} ${status.error_message ?? ''}`,
    );
    if (
      status.status === 'delivered' ||
      status.status === 'failed' ||
      status.status === 'undelivered'
    ) {
      break;
    }
  }
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in', envPath);
    process.exit(1);
  }

  await listContentTemplates();
  await listRecentMessages();
  await testSend();
  await listRecentMessages();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
