import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { mediaStore } from '../modules/media/store.js';

export function startJobs() {
  const tick = () => {
    const removed = mediaStore.purgeExpired();
    if (removed) logger.info('live_retention_purged', { removed, maxStreamStorageHours: env.maxStreamStorageHours });
  };
  tick();
  setInterval(tick, 10 * 60 * 1000).unref();
}
