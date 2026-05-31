import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { usersController } from './users.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me/profile', usersController.getProfile);
usersRouter.get('/me/welcome-data', usersController.getWelcomeData);
usersRouter.get('/me/profile-completeness', usersController.getProfileCompleteness);
usersRouter.post('/me/logout', usersController.logout);
