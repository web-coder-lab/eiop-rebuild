import type { NextFunction, Request, Response } from 'express';
import { AppError, errorPayload, statusOf } from '../core/errors.js';
import { logger } from '../core/logger.js';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'API route not found.'));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const requestId = String(res.locals.requestId || '');
  const status = statusOf(error);
  if (!(error instanceof AppError) || status >= 500) {
    logger.error('request_failed', {
      requestId,
      status,
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    });
  }
  res.status(status).json(errorPayload(error, requestId));
}
