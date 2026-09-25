import { Router } from 'express';
import { ok } from '../../core/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { settingsStore } from './store.js';

export const settingsRouter = Router();

function rid(res: { locals: { requestId?: string } }) {
  return String(res.locals.requestId || '');
}

settingsRouter.get('/settings', requireAuth, (req, res) => {
  ok(res, settingsStore.get(req.auth!.userId), rid(res));
});

settingsRouter.patch('/settings', requireAuth, (req, res) => {
  const body = req.body || {};
  const patch: Record<string, boolean> = {};
  for (const key of ['readReceipts', 'onlineVisible', 'notifyMessages', 'notifyCommunity'] as const) {
    if (typeof body[key] === 'boolean') patch[key] = body[key];
  }
  ok(res, settingsStore.update(req.auth!.userId, patch), rid(res));
});
