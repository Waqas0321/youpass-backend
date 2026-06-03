import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { optionalAuthenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { eventsController } from './events.controller.js';
import { createEventSchema, updateEventSchema } from './events.validators.js';

export const eventsRouter = Router();

eventsRouter.get('/types', eventsController.listTypes);
eventsRouter.get('/featured', optionalAuthenticate, eventsController.featured);
eventsRouter.get('/', optionalAuthenticate, eventsController.list);
eventsRouter.get('/:id', optionalAuthenticate, eventsController.getById);

eventsRouter.post('/', authenticate, validate(createEventSchema), eventsController.create);
eventsRouter.patch('/:id', authenticate, validate(updateEventSchema), eventsController.update);
eventsRouter.delete('/:id', authenticate, eventsController.remove);
