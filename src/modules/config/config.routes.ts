import { Router } from 'express';
import { configController } from './config.controller.js';

export const configRouter = Router();

configRouter.get('/countries', configController.listCountries);
configRouter.get('/currency/:country', configController.getCurrency);
configRouter.get('/language/:country', configController.getLanguage);
configRouter.get('/payment-gateway/:country', configController.getPaymentGateway);
