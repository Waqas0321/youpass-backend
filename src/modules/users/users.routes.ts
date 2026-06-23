import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { uploadProfilePhoto } from '../../common/middleware/upload-profile-photo.js';
import { deleteAccountVerifySchema } from '../auth/auth.validators.js';
import {
  toggleNotificationsSchema,
  updateNotificationSettingsSchema,
} from './notification-settings.validators.js';
import { updateProfileSchema } from './users.validators.js';
import { favoritesController } from '../events/favorites.controller.js';
import {
  favoritesCombinedController,
  producerFavoritesController,
} from '../producers/producer-favorites.controller.js';
import { invitationsController, paymentMethodsController } from '../invitations/invitations.controller.js';
import { ticketsRouter } from '../tickets/tickets.routes.js';
import { ticketOrdersRouter } from '../ticket-orders/ticket-orders.routes.js';
import { usersController } from './users.controller.js';
import { eventDrinkOrdersController } from '../event-drinks/event-drink-orders.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.use('/me/tickets', ticketsRouter);
usersRouter.use('/me/ticket-orders', ticketOrdersRouter);
usersRouter.get('/me/drink-orders', eventDrinkOrdersController.listMine);
usersRouter.get('/me/drink-orders/:orderId', eventDrinkOrdersController.getMine);

usersRouter.get('/me', usersController.getProfile);
usersRouter.get('/me/profile', usersController.getProfile);
usersRouter.get('/me/welcome-data', usersController.getWelcomeData);
usersRouter.get('/me/profile-completeness', usersController.getProfileCompleteness);
usersRouter.get('/me/profile-banner/status', usersController.getProfileBannerStatus);
usersRouter.post('/me/profile-banner/dismiss', usersController.dismissProfileBanner);
usersRouter.patch('/me/profile', validate(updateProfileSchema), usersController.updateProfile);
usersRouter.post('/me/profile-photo', uploadProfilePhoto, usersController.uploadProfilePhoto);
usersRouter.post('/me/photo', uploadProfilePhoto, usersController.uploadProfilePhoto);
usersRouter.delete('/me/photo', usersController.deleteProfilePhoto);
usersRouter.get('/me/category-benefits', usersController.getCategoryBenefits);
usersRouter.get('/me/favorites', favoritesCombinedController.listAll);
usersRouter.get('/me/favorites/events', favoritesController.list);
usersRouter.post('/me/favorites/events/:eventId', favoritesController.add);
usersRouter.delete('/me/favorites/events/:eventId', favoritesController.remove);
usersRouter.get('/me/favorites/producers', producerFavoritesController.list);
usersRouter.post('/me/favorites/producers/:producerId', producerFavoritesController.follow);
usersRouter.delete(
  '/me/favorites/producers/:producerId',
  producerFavoritesController.unfollow,
);
usersRouter.get('/me/invitations', invitationsController.list);
usersRouter.get('/me/invitations/summary', invitationsController.summary);
usersRouter.get('/me/invitations/:id/status', invitationsController.getStatus);
usersRouter.get('/me/invitations/:id', invitationsController.getById);
usersRouter.post('/me/invitations/:id/accept', invitationsController.accept);
usersRouter.post('/me/invitations/:id/reject', invitationsController.reject);
usersRouter.post('/me/invitations/:id/cancel', invitationsController.cancel);
usersRouter.get('/me/payment-methods', paymentMethodsController.list);
usersRouter.post('/me/payment-methods', paymentMethodsController.save);
usersRouter.get('/me/wallet/cards', paymentMethodsController.listWallet);
usersRouter.post('/me/wallet/cards', paymentMethodsController.save);
usersRouter.post('/me/wallet/cards/tokenize-session', paymentMethodsController.createTokenizeSession);
usersRouter.delete('/me/wallet/cards/:id', paymentMethodsController.remove);
usersRouter.patch('/me/wallet/cards/:id/default', paymentMethodsController.setDefault);
usersRouter.get('/me/wallet/balance', paymentMethodsController.getBalance);
usersRouter.get('/me/wallet/transactions', paymentMethodsController.listTransactions);
usersRouter.get('/me/notification-settings', usersController.getNotificationSettings);
usersRouter.patch(
  '/me/notification-settings',
  validate(updateNotificationSettingsSchema),
  usersController.updateNotificationSettings,
);
usersRouter.post(
  '/me/notifications/toggle',
  validate(toggleNotificationsSchema),
  usersController.toggleNotificationsMaster,
);
usersRouter.post('/me/logout', usersController.logout);
usersRouter.post('/me/delete-account/request', usersController.deleteAccountRequest);
usersRouter.post('/me/delete-account/verify', validate(deleteAccountVerifySchema), usersController.deleteAccountVerify);
usersRouter.post('/me/account/delete-request', usersController.deleteAccountRequest);
usersRouter.post('/me/account/delete-confirm', validate(deleteAccountVerifySchema), usersController.deleteAccountVerify);
usersRouter.post('/me/account/delete-cancel', usersController.cancelAccountDeletion);
usersRouter.get('/me/account/deletion-status', usersController.getDeletionStatus);
