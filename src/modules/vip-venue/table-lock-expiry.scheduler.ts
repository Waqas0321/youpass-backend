import { processExpiredTableLocks } from './vip-venue.service.js';

const PURGE_INTERVAL_MS = 60 * 1000;

export function startTableLockExpiryScheduler(): void {
  const run = async () => {
    try {
      const expired = await processExpiredTableLocks();
      if (expired > 0) {
        console.log(`[table-locks] Expired ${expired} active table lock(s)`);
      }
    } catch (error) {
      console.error('[table-locks] Expiry purge failed:', error);
    }
  };

  void run();
  setInterval(run, PURGE_INTERVAL_MS);
}
