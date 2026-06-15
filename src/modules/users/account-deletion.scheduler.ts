import { accountDeletionService } from './account-deletion.service.js';

const DELETION_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function startAccountDeletionScheduler(): void {
  const run = async () => {
    try {
      const finalized = await accountDeletionService.processDueDeletions();
      if (finalized > 0) {
        console.log(`[account-deletion] Finalized ${finalized} account(s)`);
      }
    } catch (error) {
      console.error('[account-deletion] Scheduler run failed:', error);
    }
  };

  void run();
  setInterval(run, DELETION_CHECK_INTERVAL_MS);
}
