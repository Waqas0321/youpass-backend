import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { vipVenueController } from './vip-venue.controller.js';

export const vipVenueRouter = Router({ mergeParams: true });

vipVenueRouter.get('/ticket-types', vipVenueController.listTicketTypes);
vipVenueRouter.get('/venue-layout', optionalAuthenticate, vipVenueController.getVenueLayout);
vipVenueRouter.get('/tables/availability/realtime', optionalAuthenticate, vipVenueController.getRealtimeAvailability);
vipVenueRouter.get('/zones/:zoneId/tables', optionalAuthenticate, vipVenueController.listZoneTables);
vipVenueRouter.get('/tables/:tableId', optionalAuthenticate, vipVenueController.getTable);
vipVenueRouter.post('/tables/:tableId/lock', authenticate, vipVenueController.lockTable);
vipVenueRouter.delete('/tables/:tableId/lock', authenticate, vipVenueController.releaseTableLock);
