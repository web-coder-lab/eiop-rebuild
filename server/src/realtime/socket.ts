import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { readSignedSessionId } from '../modules/auth/crypto.js';
import { authStore } from '../modules/auth/store.js';
import { contentStore } from '../modules/content/store.js';

function tokenFromSocket(socket: { handshake: { auth?: { token?: string }; headers: { cookie?: string } } }) {
  const bearer = String(socket.handshake.auth?.token || '');
  if (bearer) return bearer;
  const cookie = socket.handshake.headers.cookie || '';
  const part = cookie.split(';').map((v) => v.trim()).find((v) => v.startsWith('eiop_session='));
  if (!part) return '';
  try { return decodeURIComponent(part.slice('eiop_session='.length)); } catch { return ''; }
}

export function attachSocket(httpServer: HttpServer) {
  const origins = env.corsOrigin.split(',').map((v) => v.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    ...(origins.length ? { cors: { origin: origins, credentials: true } } : {}),
  });

  io.use((socket, next) => {
    const sessionId = readSignedSessionId(tokenFromSocket(socket));
    const session = sessionId ? authStore.getSession(sessionId) : null;
    if (!session || session.revoked) return next(new Error('UNAUTHENTICATED'));
    socket.data.userId = session.userId;
    socket.data.sessionId = session.id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on('join_conversation', (conversationId: string) => {
      const conv = contentStore.getConversation(String(conversationId || ''));
      if (!conv || !conv.memberIds.includes(socket.data.userId)) {
        socket.emit('error', { code: 'FORBIDDEN', message: 'You do not have access to this resource.' });
        return;
      }
      socket.join(`conversation:${conv.id}`);
    });
  });

  logger.info('socket_attached', { auth: 'session' });
  return io;
}
