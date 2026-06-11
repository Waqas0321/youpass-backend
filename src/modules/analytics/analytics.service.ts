import { prisma } from '../../config/database.js';
import type { AuthRequestContext } from '../../common/types/auth.js';
import type { RegistrationCompletedInput } from './analytics.validators.js';

export const analyticsService = {
  async trackRegistrationCompleted(
    userId: string,
    input: RegistrationCompletedInput,
    context?: AuthRequestContext,
  ) {
    await prisma.analyticsEvent.create({
      data: {
        userId,
        eventName: 'registration_completed',
        properties: {
          source: input.source ?? 'organic',
          invitation_id: input.invitation_id ?? null,
          shared_event_id: input.shared_event_id ?? null,
          time_to_home_ms: input.time_to_home_ms ?? null,
          client_timestamp: input.client_timestamp ?? null,
        },
        deviceInfo: context?.deviceInfo as object | undefined,
        ipAddress: context?.ipAddress,
      },
    });

    return { tracked: true, event: 'registration_completed' };
  },
};
