import { Router } from 'express';
import { configController } from './config.controller.js';

export const configRouter = Router();

configRouter.get('/', configController.getAppConfig);
configRouter.get('/auth', configController.getAuthConfig);
configRouter.get('/security', configController.getSecurityConfig);
configRouter.get('/countries', configController.listCountries);
configRouter.get('/categories', configController.getBrowseCategories);
configRouter.get('/currency/:country', configController.getCurrency);
configRouter.get('/language/:country', configController.getLanguage);
configRouter.get('/payment-gateway/:country', configController.getPaymentGateway);
