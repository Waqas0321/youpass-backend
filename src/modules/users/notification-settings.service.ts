import { prisma } from '../../config/database.js';

type ChannelMap = {
  email: boolean;
  push: boolean;
  whatsapp: boolean;
};

const DEFAULT_CHANNELS: ChannelMap = { email: true, push: true, whatsapp: false };

function parseChannelMap(value: unknown, fallback: ChannelMap): ChannelMap {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const raw = value as Record<string, unknown>;
  return {
    email: raw.email !== false,
    push: raw.push !== false,
    whatsapp: raw.whatsapp === true,
  };
}

function formatSettings(record: {
  masterEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  purchasesChannels: unknown;
  remindersChannels: unknown;
  promotionsChannels: unknown;
  socialChannels: unknown;
  nightSilenceEnabled: boolean;
  nightSilenceFromHour: number | null;
}) {
  return {
    master_enabled: record.masterEnabled,
    channels: {
      email: record.emailEnabled,
      push: record.pushEnabled,
      whatsapp: record.whatsappEnabled,
    },
    types: {
      purchases: parseChannelMap(record.purchasesChannels, DEFAULT_CHANNELS),
      reminders: parseChannelMap(record.remindersChannels, {
        email: true,
        push: true,
        whatsapp: true,
      }),
      promotions: parseChannelMap(record.promotionsChannels, DEFAULT_CHANNELS),
      social: parseChannelMap(record.socialChannels, {
        email: false,
        push: true,
        whatsapp: true,
      }),
    },
    night_silence: {
      enabled: record.nightSilenceEnabled,
      from_hour: record.nightSilenceFromHour,
    },
    critical_always_on: [
      'event_cancellation',
      'event_datetime_change',
      'event_venue_change',
      'security_alerts',
      'payment_receipts',
      'processed_refunds',
    ],
  };
}

async function ensureSettings(userId: string) {
  return prisma.userNotificationSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export const notificationSettingsService = {
  async getSettings(userId: string) {
    const record = await ensureSettings(userId);
    return formatSettings(record);
  },

  async updateSettings(
    userId: string,
    input: {
      master_enabled?: boolean;
      channels?: Partial<Record<'email' | 'push' | 'whatsapp', boolean>>;
      types?: Partial<
        Record<'purchases' | 'reminders' | 'promotions' | 'social', Partial<ChannelMap>>
      >;
      night_silence?: { enabled?: boolean; from_hour?: number | null };
    },
  ) {
    const current = await ensureSettings(userId);
    const purchases = parseChannelMap(current.purchasesChannels, DEFAULT_CHANNELS);
    const reminders = parseChannelMap(current.remindersChannels, {
      email: true,
      push: true,
      whatsapp: true,
    });
    const promotions = parseChannelMap(current.promotionsChannels, DEFAULT_CHANNELS);
    const social = parseChannelMap(current.socialChannels, {
      email: false,
      push: true,
      whatsapp: true,
    });

    if (input.types?.purchases) {
      Object.assign(purchases, input.types.purchases);
    }
    if (input.types?.reminders) {
      Object.assign(reminders, input.types.reminders);
    }
    if (input.types?.promotions) {
      Object.assign(promotions, input.types.promotions);
    }
    if (input.types?.social) {
      Object.assign(social, input.types.social);
    }

    const updated = await prisma.userNotificationSettings.update({
      where: { userId },
      data: {
        masterEnabled: input.master_enabled ?? current.masterEnabled,
        emailEnabled: input.channels?.email ?? current.emailEnabled,
        pushEnabled: input.channels?.push ?? current.pushEnabled,
        whatsappEnabled: input.channels?.whatsapp ?? current.whatsappEnabled,
        purchasesChannels: purchases,
        remindersChannels: reminders,
        promotionsChannels: promotions,
        socialChannels: social,
        nightSilenceEnabled: input.night_silence?.enabled ?? current.nightSilenceEnabled,
        nightSilenceFromHour:
          input.night_silence?.from_hour !== undefined
            ? input.night_silence.from_hour
            : current.nightSilenceFromHour,
      },
    });

    return formatSettings(updated);
  },

  async toggleMaster(userId: string, enabled: boolean) {
    const updated = await prisma.userNotificationSettings.upsert({
      where: { userId },
      create: { userId, masterEnabled: enabled },
      update: { masterEnabled: enabled },
    });
    return formatSettings(updated);
  },
};
