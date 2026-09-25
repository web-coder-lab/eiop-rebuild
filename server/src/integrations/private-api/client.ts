import { env, integrationFlags } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

export const privateApi = {
  configured() {
    return integrationFlags().privateApi;
  },
  async ping(): Promise<'configured' | 'NOT_CONFIGURED'> {
    return this.configured() ? 'configured' : 'NOT_CONFIGURED';
  },
  requireConfigured() {
    if (!this.configured()) {
      throw new AppError(503, 'PRIVATE_API_NOT_CONFIGURED', 'Content service is unavailable.');
    }
    return {
      baseUrl: env.privateApiBaseUrl,
      timeoutMs: env.privateApiTimeoutMs,
    };
  },
};
