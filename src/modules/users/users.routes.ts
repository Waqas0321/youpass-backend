import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { uploadProfilePhoto } from '../../common/middleware/upload-profile-photo.js';
import { deleteAccountVerifySchema } from '../auth/auth.validators.js';
import { updateProfileSchema } from './users.validators.js';
import { favoritesController } from '../events/favorites.controller.js';
import { invitationsController, paymentMethodsController } from '../invitations/invitations.controller.js';
import { ticketsRouter } from '../tickets/tickets.routes.js';
import { usersController } from './users.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.use('/me/tickets', ticketsRouter);

usersRouter.get('/me', usersController.getProfile);
usersRouter.get('/me/profile', usersController.getProfile);
usersRouter.get('/me/welcome-data', usersController.getWelcomeData);
usersRouter.get('/me/profile-completeness', usersController.getProfileCompleteness);
usersRouter.patch('/me/profile', validate(updateProfileSchema), usersController.updateProfile);
usersRouter.post('/me/profile-photo', uploadProfilePhoto, usersController.uploadProfilePhoto);
usersRouter.get('/me/favorites/events', favoritesController.list);
usersRouter.post('/me/favorites/events/:eventId', favoritesController.add);
usersRouter.delete('/me/favorites/events/:eventId', favoritesController.remove);
usersRouter.get('/me/invitations', invitationsController.list);
usersRouter.get('/me/invitations/summary', invitationsController.summary);
usersRouter.get('/me/payment-methods', paymentMethodsController.list);
usersRouter.post('/me/payment-methods', paymentMethodsController.save);
usersRouter.post('/me/logout', usersController.logout);
usersRouter.post('/me/delete-account/request', usersController.deleteAccountRequest);
usersRouter.post('/me/delete-account/verify', validate(deleteAccountVerifySchema), usersController.deleteAccountVerify);
