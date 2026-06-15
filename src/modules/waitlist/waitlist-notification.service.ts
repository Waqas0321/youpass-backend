import type { Event, User, WaitlistOffer } from '@prisma/client';
import { invitationDeliveryService } from '../messaging/invitation-delivery.service.js';
import { buildWaitlistOfferDeepLink } from './waitlist-deep-link.utils.js';
import { formatDeadlineLabel } from '../invitations/invitations.utils.js';
import { getTimezone } from '../invitations/invitations.formatter.js';

type NotifyContext = {
  user: User;
  event: Event;
  offer?: WaitlistOffer;
  position?: number;
};

async function dispatchChannels(
  label: string,
  channels: {
    push?: { title: string; body: string; deepLink?: string };
    whatsapp?: { phone: string; body: string };
  },
) {
  const tasks: Promise<void>[] = [];

  if (channels.push) {
    tasks.push(
      Promise.resolve().then(() => {
        console.info(`[waitlist-notify/push] ${label}`, channels.push);
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
          console.error(`[waitlist-notify/whatsapp] ${label}`, error);
        }),
    );
  }

  await Promise.all(tasks);
}

export const waitlistNotificationService = {
  async sendJoinedConfirmation(ctx: NotifyContext) {
    const deepLink = buildWaitlistOfferDeepLink(ctx.event.id);
    await dispatchChannels('waitlist-joined', {
      push: {
        title: 'You are on the waiting list',
        body: `You are #${ctx.position ?? '—'} on the waiting list for ${ctx.event.title}.`,
        deepLink,
      },
      whatsapp: {
        phone: ctx.user.phone,
        body:
          `Hi ${ctx.user.fullName}! ✅\n` +
          `You are #${ctx.position ?? '—'} on the waiting list for ${ctx.event.title}.\n` +
          `We will notify you immediately if a courtesy slot opens up.\n` +
          `Open YouPass: ${deepLink}`,
      },
    });
  },

  async sendSlotOffer(ctx: NotifyContext & { offer: WaitlistOffer; offerHours: number }) {
    const timezone = getTimezone(ctx.event.countryCode);
    const deadline = formatDeadlineLabel(ctx.offer.expiresAt, timezone);
    const deepLink = buildWaitlistOfferDeepLink(ctx.event.id, ctx.offer.id);

    await dispatchChannels('waitlist-offer', {
      push: {
        title: `🎉 A slot just opened for ${ctx.event.title}!`,
        body: `You have ${ctx.offerHours} hours to confirm. Tap now!`,
        deepLink,
      },
      whatsapp: {
        phone: ctx.user.phone,
        body:
          `Hi ${ctx.user.fullName}! 🎉\n` +
          `A courtesy slot just opened for ${ctx.event.title}.\n` +
          `You have until ${deadline} to confirm.\n` +
          `Open YouPass now: ${deepLink}`,
      },
    });
  },

  async sendOfferReminder(ctx: NotifyContext & { offer: WaitlistOffer }) {
    const deepLink = buildWaitlistOfferDeepLink(ctx.event.id, ctx.offer.id);
    await dispatchChannels('waitlist-offer-reminder', {
      push: {
        title: '⚡ 1 hour left to claim your slot',
        body: `Confirm your courtesy slot for ${ctx.event.title} before it passes to the next person.`,
        deepLink,
      },
      whatsapp: {
        phone: ctx.user.phone,
        body:
          `Hi ${ctx.user.fullName}! ⏰\n` +
          `You have 1 hour left to claim your courtesy slot for ${ctx.event.title}.\n` +
          `Open YouPass now: ${deepLink}`,
      },
    });
  },

  async sendOfferExpired(ctx: NotifyContext) {
    await dispatchChannels('waitlist-offer-expired', {
      push: {
        title: 'Slot offer expired',
        body: `Your slot offer for ${ctx.event.title} has expired. You have been removed from the waiting list.`,
      },
      whatsapp: {
        phone: ctx.user.phone,
        body:
          `Hi ${ctx.user.fullName},\n` +
          `Your slot offer for ${ctx.event.title} has expired.\n` +
          `You have been removed from the waiting list.`,
      },
    });
  },
};
