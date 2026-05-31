import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import {
  sendCodeSchema,
  resendCodeSchema,
  verifyCodeSchema,
  checkWhatsAppSchema,
  loginSchema,
  registerSchema,
  changePhoneRequestSchema,
  changePhoneVerifySchema,
} from './auth.validators.js';

export const authRouter = Router();

authRouter.post('/send-code', validate(sendCodeSchema), authController.sendCode);
authRouter.post('/resend-code', validate(resendCodeSchema), authController.resendCode);
authRouter.post('/verify-code', validate(verifyCodeSchema), authController.verifyCode);
authRouter.post('/check-whatsapp', validate(checkWhatsAppSchema), authController.checkWhatsApp);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.post('/change-phone/request', authenticate, validate(changePhoneRequestSchema), authController.changePhoneRequest);
authRouter.post('/change-phone/verify', authenticate, validate(changePhoneVerifySchema), authController.changePhoneVerify);
