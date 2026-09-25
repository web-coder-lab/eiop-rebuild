import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
};

export async function verifyGoogleIdToken(idToken: string) {
  if (!env.googleClientId) {
    throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google login is unavailable.');
  }
  if (!idToken || idToken.length < 20 || idToken.length > 4096) {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google login failed.');
  }
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google login failed.');
  const info = (await response.json()) as GoogleTokenInfo;
  if (info.aud !== env.googleClientId || !info.sub || !info.email) {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google login failed.');
  }
  if (info.email_verified && info.email_verified !== 'true') {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google login failed.');
  }
  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    name: info.name || info.email.split('@')[0],
  };
}
