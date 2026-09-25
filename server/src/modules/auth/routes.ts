import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ok } from '../../core/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { authService } from './service.js';
import { clearSessionCookie, setSessionCookie } from './cookies.js';

export const authRouter = Router();

const authLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const otpLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

function meta(req: { headers: Record<string, unknown>; ip?: string }) {
  return {
    userAgent: String(req.headers['user-agent'] || ''),
    ip: String(req.ip || ''),
  };
}

function rid(res: { locals: { requestId?: string } }) {
  return String(res.locals.requestId || '');
}

authRouter.post('/signup/otp/request', otpLimit, async (req, res, next) => {
  try { ok(res, await authService.requestOtp(String(req.body?.email || ''), 'signup'), rid(res)); }
  catch (error) { next(error); }
});

authRouter.post('/signup/otp/verify', otpLimit, (req, res) => {
  ok(res, authService.verifyOtp(String(req.body?.email || ''), String(req.body?.code || ''), 'signup'), rid(res));
});

authRouter.post('/register', authLimit, (req, res) => {
  const result = authService.register({
    email: String(req.body?.email || ''),
    username: String(req.body?.username || ''),
    fullName: String(req.body?.fullName || ''),
    password: String(req.body?.password || ''),
    otp: String(req.body?.otp || req.body?.code || ''),
  });
  ok(res, { user: result.user, requiresLogin: true }, rid(res), 201);
});

authRouter.post('/login', authLimit, (req, res) => {
  const result = authService.login({
    usernameOrEmail: String(req.body?.usernameOrEmail || req.body?.email || ''),
    password: String(req.body?.password || ''),
  }, meta(req));
  setSessionCookie(res, result.sessionId);
  ok(res, { user: result.user }, rid(res));
});

authRouter.post('/google', authLimit, async (req, res, next) => {
  try {
    const result = await authService.googleLogin(String(req.body?.idToken || ''), meta(req));
    setSessionCookie(res, result.sessionId);
    ok(res, { user: result.user }, rid(res));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/recovery/request', otpLimit, async (req, res, next) => {
  try { ok(res, await authService.requestRecovery(String(req.body?.email || '')), rid(res)); }
  catch (error) { next(error); }
});

authRouter.post('/recovery/confirm', authLimit, (req, res) => {
  ok(res, authService.confirmRecovery({
    email: String(req.body?.email || ''),
    otp: String(req.body?.otp || req.body?.code || ''),
    password: String(req.body?.password || ''),
  }), rid(res));
});

authRouter.post('/logout', (req, res) => {
  if (req.auth?.sessionId) authService.logout(req.auth.sessionId);
  clearSessionCookie(res);
  ok(res, { loggedOut: true }, rid(res));
});

authRouter.post('/logout-all', requireAuth, (req, res) => {
  authService.logoutAll(req.auth!.userId);
  clearSessionCookie(res);
  ok(res, { loggedOut: true }, rid(res));
});

authRouter.get('/me', requireAuth, (req, res) => {
  ok(res, { user: authService.me(req.auth!.userId) }, rid(res));
});

authRouter.post('/password', requireAuth, (req, res) => {
  ok(res, authService.changePassword(req.auth!.userId, String(req.body?.current || ''), String(req.body?.next || req.body?.password || '')), rid(res));
});

authRouter.get('/sessions', requireAuth, (req, res) => {
  ok(res, authService.listSessions(req.auth!.userId, req.auth!.sessionId), rid(res));
});

authRouter.delete('/sessions/:id', requireAuth, (req, res) => {
  ok(res, authService.revokeSession(req.auth!.userId, String(req.params.id || '')), rid(res));
});
