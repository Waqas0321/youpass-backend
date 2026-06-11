import { Router } from 'express';
import { webhooksController } from './webhooks.controller.js';

export const webhooksRouter = Router();

webhooksRouter.post('/klap', webhooksController.klap);
webhooksRouter.post('/stripe', webhooksController.stripe);
