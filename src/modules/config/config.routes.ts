import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import { requireAdminApiKey } from '../../common/middleware/admin-api-key.js';
import { configController } from './config.controller.js';
import { eventCategoriesController } from './event-categories.controller.js';
import {
  createEventCategorySchema,
  updateEventCategorySchema,
} from './event-categories.validators.js';
import { homeBannersController } from './home-banners.controller.js';
import { eventListingConfigController } from './event-listing.controller.js';
import {
  createHomeBannerSchema,
  updateHomeBannerSchema,
} from './home-banners.validators.js';
import { updateEventListingConfigSchema } from './event-listing.validators.js';
import { invitationConfigController } from './invitation-config.controller.js';
import { updateInvitationConfigSchema } from './invitation-config.validators.js';

export const configRouter = Router();

configRouter.get('/', configController.getAppConfig);
configRouter.get('/auth', configController.getAuthConfig);
configRouter.get('/security', configController.getSecurityConfig);
configRouter.get('/countries', configController.listCountries);
configRouter.get('/categories', configController.getBrowseCategories);
configRouter.get('/event-categories', eventCategoriesController.listActive);
configRouter.get(
  '/event-categories/all',
  requireAdminApiKey,
  eventCategoriesController.listAll,
);
configRouter.post(
  '/event-categories',
  requireAdminApiKey,
  validate(createEventCategorySchema),
  eventCategoriesController.create,
);
configRouter.patch(
  '/event-categories/:id',
  requireAdminApiKey,
  validate(updateEventCategorySchema),
  eventCategoriesController.update,
);
configRouter.get('/home-banners/carousel', homeBannersController.getCarouselConfig);
configRouter.get('/event-listing', eventListingConfigController.getConfig);
configRouter.patch(
  '/event-listing',
  requireAdminApiKey,
  validate(updateEventListingConfigSchema),
  eventListingConfigController.updateConfig,
);
configRouter.get('/invitations', invitationConfigController.getConfig);
configRouter.patch(
  '/invitations',
  requireAdminApiKey,
  validate(updateInvitationConfigSchema),
  invitationConfigController.updateConfig,
);
configRouter.get(
  '/home-banners/all',
  requireAdminApiKey,
  homeBannersController.listAll,
);
configRouter.post(
  '/home-banners',
  requireAdminApiKey,
  validate(createHomeBannerSchema),
  homeBannersController.create,
);
configRouter.patch(
  '/home-banners/:id',
  requireAdminApiKey,
  validate(updateHomeBannerSchema),
  homeBannersController.update,
);
configRouter.delete(
  '/home-banners/:id',
  requireAdminApiKey,
  homeBannersController.remove,
);
configRouter.get('/currency/:country', configController.getCurrency);
configRouter.get('/language/:country', configController.getLanguage);
configRouter.get('/payment-gateway/:country', configController.getPaymentGateway);
