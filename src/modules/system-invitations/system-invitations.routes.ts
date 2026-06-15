import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { successResponse } from '../../common/utils/crypto.js';
import { assertDashboardApiKey } from '../../common/middleware/dashboard-auth.js';
import { purgeAllExpiredPendingInvitations } from '../invitations/invitation-expiry.scheduler.js';
import { processEndedEventsForNoShows } from '../invitations/guaranteed-pass-event-close.scheduler.js';
import { processGuaranteedPassReminders } from '../invitations/guaranteed-pass-reminder.scheduler.js';
import { invitationAuditService } from '../invitations/invitation-audit.service.js';
import { waitlistService } from '../waitlist/waitlist.service.js';

const postEventChargesSchema = z.object({
  event_id: z.string().optional(),
});

export const systemInvitationsRouter = Router();

systemInvitationsRouter.use((req: Request, _res: Response, next: NextFunction) => {
  try {
    assertDashboardApiKey(req);
    next();
  } catch (err) {
    next(err);
  }
});

systemInvitationsRouter.post(
  '/post-event-charges',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = postEventChargesSchema.parse(req.body ?? {});
      const chargedEvents = await processEndedEventsForNoShows();
      await invitationAuditService.log({
        actorType: 'system',
        action: 'post_event_charges',
        result: 'success',
        metadata: { event_id: body.event_id ?? null, charged_events: chargedEvents },
      });
      res.json(
        successResponse({
          processed_events: chargedEvents,
          message: 'Post-event charge job completed',
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

systemInvitationsRouter.post(
  '/release-expired',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const removed = await purgeAllExpiredPendingInvitations();
      await invitationAuditService.log({
        actorType: 'system',
        action: 'release_expired',
        result: 'success',
        metadata: { expired_count: removed },
      });
      res.json(
        successResponse({
          expired_count: removed,
          message: 'Expired invitations released',
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

systemInvitationsRouter.post(
  '/process-waitlist-offers',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [expired, reminders] = await Promise.all([
        waitlistService.processExpiredOffers(),
        waitlistService.processOfferReminders(),
      ]);
      await invitationAuditService.log({
        actorType: 'system',
        action: 'process_waitlist_offers',
        result: 'success',
        metadata: { expired_offers: expired, reminders_sent: reminders },
      });
      res.json(
        successResponse({
          expired_offers: expired,
          reminders_sent: reminders,
          message: 'Waiting list offers processed',
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

systemInvitationsRouter.post(
  '/send-reminders',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sent = await processGuaranteedPassReminders();
      await invitationAuditService.log({
        actorType: 'system',
        action: 'send_reminders',
        result: 'success',
        metadata: { reminders_sent: sent },
      });
      res.json(
        successResponse({
          reminders_sent: sent,
          message: 'Guaranteed Pass reminders processed',
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);
