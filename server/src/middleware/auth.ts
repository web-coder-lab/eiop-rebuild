import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../core/errors.js';
import { readSignedSessionId } from '../modules/auth/crypto.js';
import { authStore } from '../modules/auth/store.js';

export type AuthContext = {
  userId: string;
  sessionId: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function readSessionCookie(req: Request): string {
  const header = req.header('Cookie') || '';
  const part = header.split(';').map((v) => v.trim()).find((v) => v.startsWith('eiop_session='));
  if (!part) return '';
  try {
    return decodeURIComponent(part.slice('eiop_session='.length));
  } catch {
    return '';
  }
}

export function readToken(req: Request): string {
  const header = req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return readSessionCookie(req);
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.auth = undefined;
  const raw = readToken(req);
  if (!raw) return next();
  const sessionId = readSignedSessionId(raw);
  if (!sessionId) return next();
  const session = authStore.touchSession(sessionId);
  if (!session || session.revoked) return next();
  req.auth = { userId: session.userId, sessionId: session.id };
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
  }
  next();
}
