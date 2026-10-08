import { Router } from 'express';
import { webhooksController } from './webhooks.controller.js';

export const webhooksRouter = Router();

webhooksRouter.get('/whatsapp', webhooksController.whatsappVerify);
webhooksRouter.post('/whatsapp', webhooksController.whatsapp);
webhooksRouter.post('/klap', webhooksController.klap);
webhooksRouter.post('/stripe', webhooksController.stripe);
webhooksRouter.post('/kushki', webhooksController.kushki);
