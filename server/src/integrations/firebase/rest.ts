import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

type TokenCache = { accessToken: string; expiresAt: number };
let cache: TokenCache | null = null;

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

async function accessToken() {
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache.accessToken;
  if (!env.firebaseClientEmail || !env.firebasePrivateKey || !env.firebaseProjectId) {
    throw new AppError(503, 'FIREBASE_NOT_CONFIGURED', 'Firebase storage is unavailable until the project keys are set on the server.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: env.firebaseClientEmail,
    sub: env.firebaseClientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: [
      'https://www.googleapis.com/auth/datastore',
      'https://www.googleapis.com/auth/devstorage.full_control',
    ].join(' '),
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const assertion = `${header}.${payload}.${signer.sign(env.firebasePrivateKey, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !body.access_token) {
    throw new AppError(502, 'FIREBASE_AUTH_FAILED', 'Firebase could not be reached.');
  }
  cache = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in || 3600) - 60) * 1000,
  };
  return cache.accessToken;
}

function bucket() {
  return env.firebaseStorageBucket || `${env.firebaseProjectId}.appspot.com`;
}

export const firebaseRest = {
  async writeDocument(collection: string, id: string, data: Record<string, unknown>) {
    const token = await accessToken();
    const name = `projects/${env.firebaseProjectId}/databases/(default)/documents/${collection}/${id}`;
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number') fields[key] = { integerValue: String(Math.trunc(value)) };
      else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
      else fields[key] = { stringValue: typeof value === 'string' ? value : JSON.stringify(value) };
    }
    const response = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!response.ok) throw new AppError(502, 'FIREBASE_WRITE_FAILED', 'Could not save to Firebase.');
    return { collection, id };
  },
  async writeObject(objectPath: string, bytes: Buffer, contentType: string) {
    const token = await accessToken();
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket())}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new AppError(502, 'FIREBASE_WRITE_FAILED', 'Could not save to Firebase Storage.');
    return { bucket: bucket(), path: objectPath };
  },
};
