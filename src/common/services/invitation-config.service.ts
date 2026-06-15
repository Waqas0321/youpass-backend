import { prisma } from '../../config/database.js';

export type InvitationConfigValues = {
  expiryDays: number;
};

const DEFAULT_CONFIG: InvitationConfigValues = {
  expiryDays: 3,
};

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export const invitationConfigService = {
  async getConfig(): Promise<InvitationConfigValues> {
    const config = await prisma.invitationConfig.findUnique({
      where: { configKey: 'default' },
    });

    if (!config) {
      return DEFAULT_CONFIG;
    }

    return {
      expiryDays: config.expiryDays,
    };
  },

  async updateConfig(input: Partial<InvitationConfigValues>) {
    const current = await this.getConfig();
    const next = {
      expiryDays: input.expiryDays ?? current.expiryDays,
    };

    const record = await prisma.invitationConfig.upsert({
      where: { configKey: 'default' },
      create: {
        configKey: 'default',
        ...next,
      },
      update: next,
    });

    return {
      expiry_days: record.expiryDays,
      updated_at: record.updatedAt.toISOString(),
    };
  },

  formatConfig(config: InvitationConfigValues) {
    return {
      expiry_days: config.expiryDays,
    };
  },

  async computeExpiresAt(sentAt: Date = new Date()): Promise<Date> {
    const { expiryDays } = await this.getConfig();
    return addDays(sentAt, expiryDays);
  },

  resolveExpiresAt(
    invitation: { sentAt: Date; expiresAt: Date | null },
    expiryDays: number,
  ): Date {
    return invitation.expiresAt ?? addDays(invitation.sentAt, expiryDays);
  },
};
