import { Router } from 'express';
import { AppError } from '../core/errors.js';
import { healthRouter } from './health.routes.js';
import { authRouter } from '../modules/auth/routes.js';
import { contentRouter } from '../modules/content/routes.js';
import { mediaRouter } from '../modules/media/routes.js';
import { settingsRouter } from '../modules/settings/routes.js';
import { paymentsRouter } from './payments.routes.js';
import { commerceRouter } from '../modules/commerce/routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use(contentRouter);
apiRouter.use(mediaRouter);
apiRouter.use(settingsRouter);
apiRouter.use(paymentsRouter);
apiRouter.use(commerceRouter);

apiRouter.use((_req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
});
