import { env, integrationFlags } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

export const paymentGateway = {
  configured() {
    return integrationFlags().payments;
  },
  requireConfigured() {
    if (!this.configured()) {
      throw new AppError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Payments are unavailable until the gateway keys are set on the server.');
    }
  },
  async createCheckout(_input: { userId: string; amount: number; currency: string }) {
    this.requireConfigured();
    throw new AppError(503, 'PAYMENT_ADAPTER_PENDING', 'Gateway URL is reserved. Wire the provider after keys arrive.');
  },
  async handleWebhook(_raw: Buffer, _headers: Record<string, unknown>) {
    if (!env.paymentWebhookSecret) {
      throw new AppError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Payments are unavailable until the gateway keys are set on the server.');
    }
    return { received: true };
  },
};
