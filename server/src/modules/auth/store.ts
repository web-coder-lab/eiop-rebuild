import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

export type UserRecord = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
  passwordSalt: string;
  googleSub?: string;
  emailVerified: boolean;
  confirmedAt?: string;
  createdAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  ip: string;
  revoked: boolean;
};

export type ChallengeRecord = {
  id: string;
  email: string;
  purpose: 'signup' | 'recovery';
  codeHash: string;
  expiresAt: number;
  attempts: number;
  cooldownUntil: number;
  verified: boolean;
  consumed: boolean;
};

const users = new Map<string, UserRecord>();
const usersByEmail = new Map<string, string>();
const usersByUsername = new Map<string, string>();
const usersByGoogle = new Map<string, string>();
const sessions = new Map<string, SessionRecord>();
const challenges = new Map<string, ChallengeRecord>();

function filePath() {
  return path.resolve(env.dataDir, 'auth-store.json');
}

function persist() {
  fs.mkdirSync(env.dataDir, { recursive: true });
  const payload = {
    users: [...users.values()],
    sessions: [...sessions.values()],
  };
  fs.writeFileSync(filePath(), JSON.stringify(payload), { mode: 0o600 });
}

function indexUser(user: UserRecord) {
  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);
  usersByUsername.set(user.username, user.id);
  if (user.googleSub) usersByGoogle.set(user.googleSub, user.id);
}

function load() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw) as { users?: UserRecord[]; sessions?: SessionRecord[] };
    for (const user of parsed.users || []) indexUser(user);
    for (const session of parsed.sessions || []) sessions.set(session.id, session);
  } catch {
    // first boot
  }
}

load();

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    emailVerified: user.emailVerified,
    confirmed: Boolean(user.confirmedAt),
    createdAt: user.createdAt,
  };
}

export const authStore = {
  createUser(input: Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }): UserRecord {
    const user: UserRecord = {
      ...input,
      id: input.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    indexUser(user);
    persist();
    return user;
  },
  updateUser(user: UserRecord) {
    indexUser(user);
    persist();
  },
  listUsers() {
    return [...users.values()];
  },
  findById(id: string) {
    return users.get(id) || null;
  },
  findByEmail(email: string) {
    const id = usersByEmail.get(email.trim().toLowerCase());
    return id ? users.get(id) || null : null;
  },
  findByUsername(username: string) {
    const id = usersByUsername.get(username.trim().toLowerCase());
    return id ? users.get(id) || null : null;
  },
  findByGoogleSub(sub: string) {
    const id = usersByGoogle.get(sub);
    return id ? users.get(id) || null : null;
  },
  createSession(input: Omit<SessionRecord, 'id' | 'createdAt' | 'lastSeenAt' | 'revoked'>): SessionRecord {
    const session: SessionRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      revoked: false,
    };
    sessions.set(session.id, session);
    persist();
    return session;
  },
  getSession(id: string) {
    return sessions.get(id) || null;
  },
  touchSession(id: string) {
    const session = sessions.get(id);
    if (!session || session.revoked) return null;
    session.lastSeenAt = new Date().toISOString();
    persist();
    return session;
  },
  revokeSession(id: string) {
    const session = sessions.get(id);
    if (session) {
      session.revoked = true;
      persist();
    }
    return session;
  },
  revokeUserSessions(userId: string, exceptId?: string) {
    for (const session of sessions.values()) {
      if (session.userId === userId && session.id !== exceptId) session.revoked = true;
    }
    persist();
  },
  listSessions(userId: string) {
    return [...sessions.values()].filter((s) => s.userId === userId);
  },
  putChallenge(record: ChallengeRecord) {
    challenges.set(`${record.purpose}:${record.email}`, record);
  },
  getChallenge(purpose: ChallengeRecord['purpose'], email: string) {
    return challenges.get(`${purpose}:${email}`) || null;
  },
};
