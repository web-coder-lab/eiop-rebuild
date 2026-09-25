import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../core/errors.js';
import { ok } from '../core/http.js';
import { paymentGateway } from '../integrations/payments/gateway.js';

export const paymentsRouter = Router();

paymentsRouter.post('/payments/webhook', async (req, res, next) => {
  try {
    if (!env.paymentWebhookSecret) {
      throw new AppError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Payments are unavailable until the gateway keys are set on the server.');
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const signature = String(req.header('X-Webhook-Signature') || req.header('X-Payment-Signature') || '');
    if (!signature) throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is required.');
    const expected = crypto.createHmac('sha256', env.paymentWebhookSecret).update(raw).digest('hex');
    const supplied = signature.replace(/^sha256=/i, '').trim();
    const valid = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!valid) throw new AppError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is invalid.');
    const result = await paymentGateway.handleWebhook(raw, req.headers as Record<string, unknown>);
    ok(res, result, String(res.locals.requestId || ''), 202);
  } catch (error) {
    next(error);
  }
});
