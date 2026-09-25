import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

export type AccountSettings = {
  userId: string;
  readReceipts: boolean;
  onlineVisible: boolean;
  notifyMessages: boolean;
  notifyCommunity: boolean;
};

const defaults = (userId: string): AccountSettings => ({
  userId,
  readReceipts: true,
  onlineVisible: true,
  notifyMessages: true,
  notifyCommunity: true,
});

const rows = new Map<string, AccountSettings>();

function filePath() {
  return path.resolve(env.dataDir, 'settings-store.json');
}

function persist() {
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify([...rows.values()]), { mode: 0o600 });
}

try {
  const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8')) as AccountSettings[];
  for (const row of parsed) rows.set(row.userId, { ...defaults(row.userId), ...row });
} catch {
  // first boot
}

export const settingsStore = {
  get(userId: string) {
    return rows.get(userId) || defaults(userId);
  },
  update(userId: string, patch: Partial<AccountSettings>) {
    const next = { ...this.get(userId), ...patch, userId };
    rows.set(userId, next);
    persist();
    return next;
  },
};
