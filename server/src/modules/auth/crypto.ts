import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const KEY_LEN = 64;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string) {
  const next = crypto.scryptSync(password, salt, KEY_LEN);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return crypto.timingSafeEqual(next, prev);
}

export function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function randomOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function sessionSecret() {
  if (env.sessionSecret && env.sessionSecret.length >= 32) return env.sessionSecret;
  if (env.nodeEnv !== 'production') {
    return 'dev-only-session-secret-do-not-use-in-prod-32';
  }
  return '';
}

export function signSessionId(sessionId: string) {
  const secret = sessionSecret();
  if (!secret) return '';
  const sig = crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
  return `${sessionId}.${sig}`;
}

export function readSignedSessionId(token: string) {
  const secret = sessionSecret();
  if (!secret || !token.includes('.')) return null;
  const sessionId = token.slice(0, token.lastIndexOf('.'));
  const sig = token.slice(token.lastIndexOf('.') + 1);
  const expected = crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}
