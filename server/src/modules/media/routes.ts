import fs from 'node:fs';
import { Router } from 'express';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/http.js';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { apkPath, mediaStore, type MediaKind } from './store.js';

export const mediaRouter = Router();

function rid(res: { locals: { requestId?: string } }) {
  return String(res.locals.requestId || '');
}

function safeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function listKind(kind: MediaKind) {
  return (_req: { auth?: { userId: string } }, res: { locals: { requestId?: string } }, next: (err?: unknown) => void) => {
    ok(res as never, mediaStore.list(kind), rid(res as never));
  };
}

mediaRouter.get('/reels', (req, res) => ok(res, mediaStore.list('reel'), rid(res)));
mediaRouter.get('/videos', (req, res) => ok(res, mediaStore.list('video'), rid(res)));
mediaRouter.get('/live', (req, res) => ok(res, mediaStore.list('live'), rid(res)));

mediaRouter.get('/reels/:id', (req, res, next) => {
  const item = mediaStore.get(String(req.params.id));
  if (!item || item.kind !== 'reel') return next(new AppError(404, 'NOT_FOUND', 'Reel not found.'));
  ok(res, item, rid(res));
});
mediaRouter.get('/videos/:id', (req, res, next) => {
  const item = mediaStore.get(String(req.params.id));
  if (!item || item.kind !== 'video') return next(new AppError(404, 'NOT_FOUND', 'Video not found.'));
  ok(res, item, rid(res));
});
mediaRouter.get('/live/:id', (req, res, next) => {
  const item = mediaStore.get(String(req.params.id));
  if (!item || item.kind !== 'live') return next(new AppError(404, 'NOT_FOUND', 'Live session not found.'));
  ok(res, item, rid(res));
});

mediaRouter.post('/media', requireAuth, (req, res, next) => {
  const kind = String(req.body?.kind || '') as MediaKind;
  if (!['reel', 'video', 'live'].includes(kind)) return next(new AppError(400, 'VALIDATION_ERROR', 'Choose reel, video, or live.'));
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const sourceUrl = safeUrl(String(req.body?.sourceUrl || ''));
  if (!title || !sourceUrl) return next(new AppError(400, 'VALIDATION_ERROR', 'Title and a valid media URL are required.'));
  const expiresAt = kind === 'live'
    ? new Date(Date.now() + env.maxStreamStorageHours * 60 * 60 * 1000).toISOString()
    : undefined;
  ok(res, mediaStore.create({ kind, ownerId: req.auth!.userId, title, sourceUrl, expiresAt }), rid(res), 201);
});

mediaRouter.post('/coins/messages', requireAuth, (_req, res, next) => {
  next(new AppError(503, 'WALLET_NOT_CONFIGURED', 'Coin balance is not available until the wallet service is configured.'));
});

mediaRouter.get('/download/apk/status', (_req, res) => {
  const file = apkPath();
  const exists = fs.existsSync(file);
  const stat = exists ? fs.statSync(file) : null;
  ok(res, {
    available: Boolean(exists && stat && stat.size > 0),
    filename: 'eiop.apk',
    bytes: stat?.size || 0,
    version: process.env.APK_VERSION || null,
  }, rid(res));
});

mediaRouter.get('/download/apk', (req, res, next) => {
  const file = apkPath();
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    return next(new AppError(404, 'APK_UNAVAILABLE', 'The Android app file is not available.'));
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="eiop.apk"');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(file);
});
