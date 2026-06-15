import { prisma } from '../../config/database.js';
import { resolveInvitationProductKind } from './invitation-product-type.utils.js';
import {
  guaranteedPassNotificationService,
  resolveGuestContact,
} from './guaranteed-pass-notification.service.js';
import { formatDeadlineLabel } from './invitations.utils.js';
import { getTimezone } from './invitations.formatter.js';
import { invitationReminderService } from './invitation-reminder.service.js';

type ReminderTemplateKey = 'seven_days' | 'five_days' | 'deadline' | 'twenty_four_h' | 'three_h';

const DEFAULT_TEMPLATES: Record<ReminderTemplateKey, string> = {
  seven_days:
    'Your Guaranteed Pass to {event} is active. If you can no longer attend, cancel before {deadline}.',
  five_days:
    '5 days until {event}. Today is your last chance to cancel your Guaranteed Pass without charge.',
  deadline:
    '⚠ TODAY is the last day to cancel your Guaranteed Pass without charge. If you do not attend, {amount} will be charged.',
  twenty_four_h: 'Tomorrow is {event}! Remember to arrive between {entry_time}.',
  three_h:
    'Your Guaranteed Pass activates in 3 hours. Your QR will be available in the YouPass app.',
};

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en')}`;
}

async function loadTemplates(): Promise<Partial<Record<ReminderTemplateKey, string>>> {
  const config = await prisma.invitationConfig.findUnique({
    where: { configKey: 'default' },
    select: { guaranteedPassReminderTemplates: true },
  });

  const custom = config?.guaranteedPassReminderTemplates;
  if (!custom || typeof custom !== 'object') {
    return DEFAULT_TEMPLATES;
  }

  return { ...DEFAULT_TEMPLATES, ...(custom as Partial<Record<ReminderTemplateKey, string>>) };
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

export async function processGuaranteedPassReminders(now = new Date()): Promise<number> {
  const templates = await loadTemplates();

  const dueReminders = await prisma.invitationReminder.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: now },
      invitation: {
        status: 'accepted',
        type: 'guaranteed',
      },
    },
    include: {
      invitation: {
        include: {
          event: true,
          producer: true,
          recipient: true,
        },
      },
    },
    take: 100,
  });

  let sent = 0;

  for (const reminder of dueReminders) {
    const invitation = reminder.invitation;
    if (resolveInvitationProductKind(invitation) !== 'guaranteed_pass') {
      await invitationReminderService.markReminderFailed(reminder.id);
      continue;
    }

    const timezone = getTimezone(invitation.event.countryCode);
    const deadline = formatDeadlineLabel(invitation.cancellationDeadline, timezone);
    const amount = formatAmount(invitation.entryValue, invitation.chargeCurrency ?? 'CLP');
    const entryTime = invitation.event.entryTimeLabel ?? 'the scheduled entry window';

    const message = renderTemplate(templates[reminder.reminderType] ?? '', {
      event: invitation.event.title,
      deadline,
      amount,
      entry_time: entryTime,
    });

    const contact = resolveGuestContact(invitation.recipient, invitation);
    await guaranteedPassNotificationService.sendReminder(
      {
        invitation,
        event: invitation.event,
        producer: invitation.producer,
        recipient: invitation.recipient,
        inviterName: invitation.producer.name,
        ...contact,
      },
      reminder.reminderType,
      message,
    );

    await invitationReminderService.markReminderSent(reminder.id);
    sent += 1;
  }

  return sent;
}

const REMINDER_INTERVAL_MS = 30 * 60 * 1000;

export function startGuaranteedPassReminderScheduler(): void {
  const run = async () => {
    try {
      const count = await processGuaranteedPassReminders();
      if (count > 0) {
        console.log(`[gp-reminders] Sent ${count} reminder(s)`);
      }
    } catch (error) {
      console.error('[gp-reminders] Scheduler failed:', error);
    }
  };

  void run();
  setInterval(run, REMINDER_INTERVAL_MS);
}
