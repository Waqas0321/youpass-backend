import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireAdminApiKey } from '../../common/middleware/admin-api-key.js';
import { validate } from '../../common/middleware/validate.js';
import {
  supportAdminController,
  supportController,
} from './support.controller.js';
import {
  createSupportFaqSchema,
  updateSupportConfigSchema,
  updateSupportFaqSchema,
} from './support.validators.js';

export const supportRouter = Router();

supportRouter.get('/contact-info', supportController.getContactInfo);
supportRouter.get('/faqs', supportController.listFaqs);
supportRouter.post('/faqs/:id/feedback', supportController.recordFaqFeedback);
supportRouter.get('/whatsapp-template', authenticate, supportController.getWhatsAppTemplate);
supportRouter.get('/email-template', authenticate, supportController.getEmailTemplate);

supportRouter.get('/admin/config', requireAdminApiKey, supportAdminController.getConfig);
supportRouter.patch(
  '/admin/config',
  requireAdminApiKey,
  validate(updateSupportConfigSchema),
  supportAdminController.updateConfig,
);
supportRouter.get('/admin/faqs', requireAdminApiKey, supportAdminController.listFaqs);
supportRouter.post(
  '/admin/faqs',
  requireAdminApiKey,
  validate(createSupportFaqSchema),
  supportAdminController.createFaq,
);
supportRouter.patch(
  '/admin/faqs/:id',
  requireAdminApiKey,
  validate(updateSupportFaqSchema),
  supportAdminController.updateFaq,
);
supportRouter.delete('/admin/faqs/:id', requireAdminApiKey, supportAdminController.deleteFaq);
