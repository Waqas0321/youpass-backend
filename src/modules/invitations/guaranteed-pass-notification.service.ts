import type { Event, Invitation, Producer, User } from '@prisma/client';
import { invitationDeliveryService } from '../messaging/invitation-delivery.service.js';
import { buildInvitationDeepLink } from './guaranteed-pass-deep-link.utils.js';
import { formatDeadlineLabel } from './invitations.utils.js';
import { getTimezone } from './invitations.formatter.js';

type GuaranteedPassContext = {
  invitation: Invitation;
  event: Event;
  producer: Producer;
  recipient?: User | null;
  inviterName: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
};

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString('en')}`;
}

function deadlineLabel(event: Event, deadline: Date | null): string {
  if (!deadline) {
    return '—';
  }
  return formatDeadlineLabel(deadline, getTimezone(event.countryCode));
}

async function dispatchChannels(
  label: string,
  channels: {
    push?: { title: string; body: string; deepLink?: string };
    whatsapp?: { phone: string; body: string };
    email?: { to: string; subject: string; body: string };
  },
) {
  const tasks: Promise<void>[] = [];

  if (channels.push) {
    tasks.push(
      Promise.resolve().then(() => {
        console.info(`[gp-notify/push] ${label}`, channels.push);
      }),
    );
  }

  if (channels.whatsapp?.phone) {
    tasks.push(
      invitationDeliveryService
        .sendGuestInvitation({
          guestPhone: channels.whatsapp.phone,
          guestName: 'Guest',
          inviterName: 'YouPass',
          eventTitle: label,
          claimUrl: channels.whatsapp.body,
        })
        .then(() => undefined)
        .catch((error) => {
          console.error(`[gp-notify/whatsapp] ${label}`, error);
        }),
    );
  }

  if (channels.email?.to) {
    tasks.push(
      Promise.resolve().then(() => {
        console.info(`[gp-notify/email] ${label}`, {
          to: channels.email!.to,
          subject: channels.email!.subject,
          body: channels.email!.body,
        });
      }),
    );
  }

  await Promise.all(tasks);
}

export const guaranteedPassNotificationService = {
  async sendInvitationReceived(ctx: GuaranteedPassContext) {
    const deepLink = buildInvitationDeepLink(ctx.invitation.id);
    const deadline = deadlineLabel(ctx.event, ctx.invitation.cancellationDeadline);
    const amount = ctx.invitation.entryValue ?? 0;
    const currency = ctx.invitation.chargeCurrency ?? 'CLP';

    await dispatchChannels('invitation-received', {
      push: {
        title: 'You have a Guaranteed Pass!',
        body: `${ctx.inviterName} invites you to ${ctx.event.title}. Tap to see details`,
        deepLink,
      },
      whatsapp: ctx.guestPhone
        ? {
            phone: ctx.guestPhone,
            body:
              `Hi ${ctx.guestName}! 👋\n` +
              `You have a GUARANTEED PASS to ${ctx.event.title}.\n` +
              `⚠ 100% FREE if you attend.\n` +
              `If you can't go, you must cancel before ${deadline} to avoid charges.\n` +
              `Open the YouPass app to confirm: ${deepLink}`,
          }
        : undefined,
      email: ctx.guestEmail
        ? {
            to: ctx.guestEmail,
            subject: `Your Guaranteed Pass to ${ctx.event.title}`,
            body:
              `Hi ${ctx.guestName},\n\n` +
              `${ctx.inviterName} sent you a Guaranteed Pass to ${ctx.event.title}.\n` +
              `Slot: ${ctx.invitation.assignedSlot ?? 'VIP'}\n` +
              `No-show charge: ${formatAmount(amount, currency)}\n` +
              `Cancel before: ${deadline}\n\n` +
              `Terms: Attendance is free. If you do not attend and do not cancel in time, ` +
              `the listed amount will be charged to your saved card.\n\n` +
              `Open in app: ${deepLink}`,
          }
        : undefined,
    });
  },

  async sendAcceptanceConfirmation(ctx: GuaranteedPassContext) {
    const deadline = deadlineLabel(ctx.event, ctx.invitation.cancellationDeadline);
    const amount = ctx.invitation.entryValue ?? 0;
    const currency = ctx.invitation.chargeCurrency ?? 'CLP';

    await dispatchChannels('acceptance-confirmation', {
      email: ctx.guestEmail
        ? {
            to: ctx.guestEmail,
            subject: `Guaranteed Pass confirmed — ${ctx.event.title}`,
            body:
              `Your Guaranteed Pass to ${ctx.event.title} is active.\n` +
              `A ${formatAmount(amount, currency)} hold is on your card (not charged).\n` +
              `Cancel before ${deadline} without charge if you cannot attend.`,
          }
        : undefined,
      whatsapp: ctx.guestPhone
        ? {
            phone: ctx.guestPhone,
            body:
              `✅ Guaranteed Pass active for ${ctx.event.title}.\n` +
              `Cancel before ${deadline} without charge.\n` +
              `Your card has a temporary hold only — not a charge.`,
          }
        : undefined,
    });
  },

  async sendCancellationConfirmation(ctx: GuaranteedPassContext) {
    await dispatchChannels('cancellation-confirmation', {
      whatsapp: ctx.guestPhone
        ? {
            phone: ctx.guestPhone,
            body: 'Your Guaranteed Pass was cancelled without charge.',
          }
        : undefined,
      push: {
        title: 'Guaranteed Pass cancelled',
        body: 'Your Guaranteed Pass was cancelled without charge.',
      },
    });
  },

  async notifyPromoterSlotReleased(ctx: GuaranteedPassContext) {
    console.info('[gp-notify/promoter]', {
      producerId: ctx.producer.id,
      producerName: ctx.producer.name,
      eventTitle: ctx.event.title,
      slot: ctx.invitation.assignedSlot,
      message: `1 VIP slot has been released for ${ctx.event.title}.`,
    });
  },

  async sendDoorValidationRelease(ctx: GuaranteedPassContext) {
    await dispatchChannels('door-validation-release', {
      email: ctx.guestEmail
        ? {
            to: ctx.guestEmail,
            subject: `Guaranteed Pass activated — ${ctx.event.title}`,
            body: 'Your Guaranteed Pass activated at no cost — enjoy the event!',
          }
        : undefined,
      whatsapp: ctx.guestPhone
        ? {
            phone: ctx.guestPhone,
            body: `✅ Welcome to ${ctx.event.title}! Your pass activated for free.`,
          }
        : undefined,
    });
  },

  async sendNoShowCharge(ctx: GuaranteedPassContext) {
    const amount = ctx.invitation.entryValue ?? 0;
    const currency = ctx.invitation.chargeCurrency ?? 'CLP';

    await dispatchChannels('no-show-charge', {
      email: ctx.guestEmail
        ? {
            to: ctx.guestEmail,
            subject: `Guaranteed Pass charge — ${ctx.event.title}`,
            body:
              `Your Guaranteed Pass was charged — you did not attend ${ctx.event.title}. ` +
              `Amount: ${formatAmount(amount, currency)}.`,
          }
        : undefined,
      whatsapp: ctx.guestPhone
        ? {
            phone: ctx.guestPhone,
            body:
              `You didn't attend ${ctx.event.title}. ` +
              `${formatAmount(amount, currency)} was charged as you agreed when accepting the pass.`,
          }
        : undefined,
    });
  },

  async sendReminder(
    ctx: GuaranteedPassContext,
    templateKey: string,
    message: string,
  ) {
    if (!ctx.guestPhone) {
      console.info(`[gp-reminder/${templateKey}]`, message);
      return;
    }

    await dispatchChannels(`reminder-${templateKey}`, {
      whatsapp: { phone: ctx.guestPhone, body: message },
    });
  },
};

export function resolveGuestContact(recipient?: User | null, invitation?: Invitation) {
  return {
    guestName: recipient?.fullName ?? invitation?.recipientName ?? 'Guest',
    guestPhone: recipient?.phone ?? invitation?.recipientPhone ?? null,
    guestEmail: recipient?.email ?? null,
  };
}
