import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

export type MediaKind = 'reel' | 'video' | 'live';

export type MediaItem = {
  id: string;
  kind: MediaKind;
  ownerId: string;
  title: string;
  sourceUrl: string;
  createdAt: string;
  expiresAt?: string;
};

const items: MediaItem[] = [];

function filePath() {
  return path.resolve(env.dataDir, 'media-store.json');
}

function persist() {
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify({ items }), { mode: 0o600 });
}

try {
  const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  items.push(...(parsed.items || []));
} catch {
  // first boot
}

export function apkPath() {
  return process.env.APK_PATH || path.resolve(env.dataDir, 'apk', 'app.apk');
}

export const mediaStore = {
  list(kind?: MediaKind) {
    const now = Date.now();
    return items.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (item.expiresAt && Date.parse(item.expiresAt) <= now) return false;
      return true;
    });
  },
  get(id: string) {
    const item = items.find((i) => i.id === id) || null;
    if (item?.expiresAt && Date.parse(item.expiresAt) <= Date.now()) return null;
    return item;
  },
  create(input: Omit<MediaItem, 'id' | 'createdAt'>) {
    const item: MediaItem = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    items.unshift(item);
    persist();
    return item;
  },
  purgeExpired() {
    const now = Date.now();
    let removed = 0;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].expiresAt && Date.parse(items[i].expiresAt) <= now) {
        items.splice(i, 1);
        removed += 1;
      }
    }
    if (removed) persist();
    return removed;
  },
};
