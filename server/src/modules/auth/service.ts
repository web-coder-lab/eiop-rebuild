import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { authStore, publicUser } from './store.js';
import { hashCode, hashPassword, normalizeEmail, normalizeUsername, randomOtp, verifyPassword } from './crypto.js';
import { verifyGoogleIdToken } from './google.js';
import { mailConfigured, sendMail } from '../../integrations/mail/smtp.js';
import { otpEmail } from '../../integrations/mail/templates.js';

const OTP_TTL_MS = 10 * 60_000;
const OTP_COOLDOWN_MS = 60_000;
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_AUTH = 'Invalid credentials.';

function deviceMeta(input: { userAgent?: string; ip?: string }) {
  return {
    userAgent: String(input.userAgent || 'unknown').slice(0, 180),
    ip: String(input.ip || '').slice(0, 64),
  };
}

export const authService = {
  async requestOtp(emailRaw: string, purpose: 'signup' | 'recovery') {
    const email = normalizeEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email.');
    }
    const existing = authStore.getChallenge(purpose, email);
    const now = Date.now();
    if (existing && existing.cooldownUntil > now) {
      throw new AppError(429, 'RATE_LIMITED', 'Wait before requesting another code.');
    }
    const code = randomOtp();
    authStore.putChallenge({
      id: crypto.randomUUID(),
      email,
      purpose,
      codeHash: hashCode(code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      cooldownUntil: now + OTP_COOLDOWN_MS,
      verified: false,
      consumed: false,
    });
    const mail = otpEmail(purpose, code);
    if (mailConfigured()) {
      await sendMail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
      logger.info('otp_mailed');
      return { sent: true, expiresIn: 600 };
    }
    if (env.nodeEnv !== 'production') {
      logger.info('otp_issued_dev_no_mail');
      return { sent: true, expiresIn: 600, devCode: code };
    }
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Email delivery is unavailable.');
  },

  verifyOtp(emailRaw: string, code: string, purpose: 'signup' | 'recovery') {
    const email = normalizeEmail(emailRaw);
    const challenge = authStore.getChallenge(purpose, email);
    if (!challenge || challenge.consumed || challenge.expiresAt < Date.now()) {
      throw new AppError(401, 'OTP_INVALID', 'That code is invalid or expired.');
    }
    challenge.attempts += 1;
    if (challenge.attempts > MAX_OTP_ATTEMPTS) {
      challenge.consumed = true;
      throw new AppError(429, 'RATE_LIMITED', 'Too many verification attempts.');
    }
    if (hashCode(String(code || '')) !== challenge.codeHash) {
      throw new AppError(401, 'OTP_INVALID', 'That code is invalid or expired.');
    }
    challenge.verified = true;
    return { verified: true, email };
  },

  consumeVerifiedOtp(email: string, purpose: 'signup' | 'recovery') {
    const challenge = authStore.getChallenge(purpose, email);
    if (!challenge || !challenge.verified || challenge.consumed || challenge.expiresAt < Date.now()) {
      throw new AppError(401, 'OTP_INVALID', 'Verify the email code before continuing.');
    }
    challenge.consumed = true;
  },

  register(input: { email: string; username: string; fullName: string; password: string; otp: string }) {
    const email = normalizeEmail(input.email);
    if (input.otp) this.verifyOtp(email, input.otp, 'signup');
    this.consumeVerifiedOtp(email, 'signup');
    const username = normalizeUsername(input.username);
    const fullName = String(input.fullName || '').trim().slice(0, 80);
    if (username.length < 3) throw new AppError(400, 'VALIDATION_ERROR', 'Username must be at least 3 characters.');
    if (fullName.length < 2) throw new AppError(400, 'VALIDATION_ERROR', 'Enter your name.');
    if (!input.password || input.password.length < 8 || input.password.length > 128) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be 8–128 characters.');
    }
    if (authStore.findByEmail(email) || authStore.findByUsername(username)) {
      throw new AppError(409, 'CONFLICT', 'Could not create that account.');
    }
    const secret = hashPassword(input.password);
    const user = authStore.createUser({
      email,
      username,
      fullName,
      passwordHash: secret.hash,
      passwordSalt: secret.salt,
      emailVerified: true,
    });
    return { user: publicUser(user), requiresLogin: true };
  },

  login(input: { usernameOrEmail: string; password: string }, meta: { userAgent?: string; ip?: string }) {
    const identifier = String(input.usernameOrEmail || '').trim();
    const user = identifier.includes('@')
      ? authStore.findByEmail(identifier)
      : authStore.findByUsername(identifier);
    if (!user || !verifyPassword(String(input.password || ''), user.passwordHash, user.passwordSalt)) {
      throw new AppError(401, 'UNAUTHENTICATED', GENERIC_AUTH);
    }
    if (!user.confirmedAt) {
      user.confirmedAt = new Date().toISOString();
      authStore.updateUser(user);
    }
    const session = authStore.createSession({ userId: user.id, ...deviceMeta(meta) });
    return { user: publicUser(user), sessionId: session.id };
  },

  async googleLogin(idToken: string, meta: { userAgent?: string; ip?: string }) {
    const profile = await verifyGoogleIdToken(idToken);
    let user = authStore.findByGoogleSub(profile.sub) || authStore.findByEmail(profile.email);
    if (!user) {
      const base = normalizeUsername(profile.name.replace(/\s+/g, '_') || profile.email.split('@')[0]);
      let username = base || `user${crypto.randomInt(1000, 9999)}`;
      while (authStore.findByUsername(username)) username = `${base}${crypto.randomInt(10, 99)}`;
      const secret = hashPassword(crypto.randomBytes(24).toString('hex'));
      user = authStore.createUser({
        email: profile.email,
        username,
        fullName: profile.name.slice(0, 80),
        passwordHash: secret.hash,
        passwordSalt: secret.salt,
        googleSub: profile.sub,
        emailVerified: true,
      });
    } else if (!user.googleSub) {
      user.googleSub = profile.sub;
      authStore.updateUser(user);
    }
    if (!user.confirmedAt) {
      user.confirmedAt = new Date().toISOString();
      authStore.updateUser(user);
    }
    const session = authStore.createSession({ userId: user.id, ...deviceMeta(meta) });
    return { user: publicUser(user), sessionId: session.id };
  },

  async requestRecovery(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const issued = await this.requestOtp(email, 'recovery');
    return { sent: true, expiresIn: issued.expiresIn, ...( 'devCode' in issued ? { devCode: issued.devCode } : {} ) };
  },

  confirmRecovery(input: { email: string; otp: string; password: string }) {
    const email = normalizeEmail(input.email);
    this.verifyOtp(email, input.otp, 'recovery');
    const user = authStore.findByEmail(email);
    if (!user) throw new AppError(401, 'OTP_INVALID', 'That code is invalid or expired.');
    if (!input.password || input.password.length < 8 || input.password.length > 128) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be 8–128 characters.');
    }
    const secret = hashPassword(input.password);
    user.passwordHash = secret.hash;
    user.passwordSalt = secret.salt;
    authStore.updateUser(user);
    authStore.revokeUserSessions(user.id);
    return { reset: true };
  },

  me(userId: string) {
    const user = authStore.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    return publicUser(user);
  },

  changePassword(userId: string, current: string, next: string) {
    const user = authStore.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    if (!verifyPassword(current, user.passwordHash, user.passwordSalt)) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Current password is incorrect.');
    }
    if (!next || next.length < 8 || next.length > 128) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be 8–128 characters.');
    }
    const secret = hashPassword(next);
    user.passwordHash = secret.hash;
    user.passwordSalt = secret.salt;
    authStore.updateUser(user);
    return { changed: true };
  },

  listSessions(userId: string, currentSessionId: string) {
    return authStore.listSessions(userId).map((session) => ({
      id: session.id,
      device: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      isCurrent: session.id === currentSessionId,
      revoked: session.revoked,
    }));
  },

  logout(sessionId: string) {
    authStore.revokeSession(sessionId);
  },

  logoutAll(userId: string) {
    authStore.revokeUserSessions(userId);
  },

  revokeSession(userId: string, sessionId: string) {
    const session = authStore.getSession(sessionId);
    if (!session || session.userId !== userId) throw new AppError(404, 'NOT_FOUND', 'Session not found.');
    authStore.revokeSession(sessionId);
    return { revoked: true };
  },
};
