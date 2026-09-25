import type { Response } from 'express';
import { env } from '../../config/env.js';
import { signSessionId } from './crypto.js';

const COOKIE = 'eiop_session';
const MAX_AGE = 30 * 24 * 60 * 60;

export function setSessionCookie(res: Response, sessionId: string) {
  const token = signSessionId(sessionId);
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${MAX_AGE}`);
}

export function clearSessionCookie(res: Response) {
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
}
