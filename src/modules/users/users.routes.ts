import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { deleteAccountVerifySchema } from '../auth/auth.validators.js';
import { usersController } from './users.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', usersController.getProfile);
usersRouter.get('/me/profile', usersController.getProfile);
usersRouter.get('/me/welcome-data', usersController.getWelcomeData);
usersRouter.get('/me/profile-completeness', usersController.getProfileCompleteness);
usersRouter.post('/me/logout', usersController.logout);
usersRouter.post('/me/delete-account/request', usersController.deleteAccountRequest);
usersRouter.post('/me/delete-account/verify', validate(deleteAccountVerifySchema), usersController.deleteAccountVerify);
