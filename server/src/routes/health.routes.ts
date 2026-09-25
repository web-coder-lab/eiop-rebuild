import { Router } from 'express';
import { integrationFlags, publicIntegrationStatus } from '../config/env.js';
import { ok } from '../core/http.js';
import { firebaseApp } from '../integrations/firebase/admin.js';

export const healthRouter = Router();


healthRouter.get('/live', (_req, res) => {
  ok(res, { status: 'ok', service: 'eiop-node', version: 'v2-part3' }, String(res.locals.requestId || ''));
});

healthRouter.get('/ready', (_req, res) => {
  const flags = integrationFlags();
  ok(res, {
    status: 'ready',
    integrations: {
      privateApi: flags.privateApi,
      firebase: flags.firebase,
      payments: flags.payments,
      googleAuth: flags.googleAuth,
      sessions: flags.sessions,
    },
  }, String(res.locals.requestId || ''));
});

healthRouter.get('/integrations', (_req, res) => {
  ok(res, publicIntegrationStatus(), String(res.locals.requestId || ''));
});

healthRouter.get('/firebase', async (_req, res, next) => {
  try {
    const result = await firebaseApp.ping();
    ok(res, { status: 'ok', project: firebaseApp.projectId(), result }, String(res.locals.requestId || ''));
  } catch (error) {
    next(error);
  }
});
