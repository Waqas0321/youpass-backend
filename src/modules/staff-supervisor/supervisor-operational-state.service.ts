import type { SupervisorOperationalState } from '@prisma/client';
import { prisma } from '../../config/database.js';

export type SupervisorOperationalFlags = {
  offlineModeEnabled: boolean;
  validationsPaused: boolean;
  vipAccessBlocked: boolean;
};

const DEFAULT_FLAGS: SupervisorOperationalFlags = {
  offlineModeEnabled: false,
  validationsPaused: false,
  vipAccessBlocked: false,
};

function toFlags(state: SupervisorOperationalState | null): SupervisorOperationalFlags {
  if (!state) {
    return DEFAULT_FLAGS;
  }

  return {
    offlineModeEnabled: state.offlineModeEnabled,
    validationsPaused: state.validationsPaused,
    vipAccessBlocked: state.vipAccessBlocked,
  };
}

export const supervisorOperationalStateService = {
  async getFlags(eventId: string): Promise<SupervisorOperationalFlags> {
    const state = await prisma.supervisorOperationalState.findUnique({
      where: { eventId },
    });

    return toFlags(state);
  },

  async getOrCreate(eventId: string): Promise<SupervisorOperationalState> {
    const existing = await prisma.supervisorOperationalState.findUnique({
      where: { eventId },
    });

    if (existing) {
      return existing;
    }

    return prisma.supervisorOperationalState.create({
      data: { eventId },
    });
  },

  async updateFlags(
    eventId: string,
    staffMemberId: string,
    patch: Partial<SupervisorOperationalFlags> & {
      lastStaffAlertAt?: Date | null;
      lastStaffAlertMessage?: string | null;
    },
  ): Promise<SupervisorOperationalState> {
    await this.getOrCreate(eventId);

    return prisma.supervisorOperationalState.update({
      where: { eventId },
      data: {
        ...patch,
        updatedByStaffMemberId: staffMemberId,
      },
    });
  },
};
