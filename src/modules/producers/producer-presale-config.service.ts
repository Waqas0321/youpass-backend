import { prisma } from '../../config/database.js';

export const producerPresaleConfigService = {
  async getPresaleWindowHours(): Promise<number> {
    const config = await prisma.producerPresaleConfig.findFirst({
      where: { configKey: 'default' },
    });
    return config?.presaleWindowHours ?? 24;
  },
};
