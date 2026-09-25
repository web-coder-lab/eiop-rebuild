import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { requestId } from './middleware/requestId.js';
import { applySecurity } from './middleware/security.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { attachSocket } from './realtime/socket.js';
import { startJobs } from './jobs/retention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

applySecurity(app);
app.use(requestId);
app.use('/api/v1/payments/webhook', express.raw({ type: '*/*', limit: '256kb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(optionalAuth);
app.use('/api/v1', apiRouter);

const clientDist = path.resolve(__dirname, env.clientDist);
app.use(express.static(clientDist, { index: false, extensions: ['html'] }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const index = path.join(clientDist, 'index.html');
  res.sendFile(index, (err) => { if (err) next(err); });
});
app.use(errorHandler);

const httpServer = http.createServer(app);
attachSocket(httpServer);
startJobs();

httpServer.listen(env.port, () => {
  logger.info('eiop_listen', { port: env.port, env: env.nodeEnv });
});

function shutdown(signal: string) {
  logger.info('shutdown', { signal });
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
