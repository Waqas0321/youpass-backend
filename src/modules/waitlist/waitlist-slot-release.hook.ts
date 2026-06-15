import { waitlistService } from '../waitlist/waitlist.service.js';

export async function triggerWaitlistForReleasedSlot(freedSlotId: string | null): Promise<void> {
  if (!freedSlotId) {
    return;
  }

  try {
    await waitlistService.onSlotReleased(freedSlotId);
  } catch (error) {
    console.error('[waitlist] failed to offer released slot', { freedSlotId, error });
  }
}
