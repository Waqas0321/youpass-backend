import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { authenticateStaff } from '../../common/middleware/authenticate-staff.js';
import { staffAuthController } from './staff-auth.controller.js';
import { staffLoginSchema, staffLookupSchema, staffSendCodeSchema } from './staff-auth.validators.js';

export const staffAuthRouter = Router();

staffAuthRouter.post('/lookup', validate(staffLookupSchema), staffAuthController.lookup);
staffAuthRouter.post('/send-code', validate(staffSendCodeSchema), staffAuthController.sendCode);
staffAuthRouter.post('/resend-code', validate(staffSendCodeSchema), staffAuthController.resendCode);
staffAuthRouter.post('/login', validate(staffLoginSchema), staffAuthController.login);
staffAuthRouter.post('/logout', authenticateStaff, staffAuthController.logout);
staffAuthRouter.get('/me', authenticateStaff, staffAuthController.me);
