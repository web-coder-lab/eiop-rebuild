import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

export type Product = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  createdAt: string;
};

export type Order = {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  status: 'awaiting_payment' | 'paid' | 'cancelled';
  createdAt: string;
};

export type EventItem = {
  id: string;
  ownerId: string;
  title: string;
  details: string;
  startsAt: string;
  createdAt: string;
};

export type Wallet = { userId: string; coins: number };

const products: Product[] = [];
const orders: Order[] = [];
const events: EventItem[] = [];
const wallets = new Map<string, Wallet>();
const rules = new Map<string, string>();
const mods = new Map<string, string[]>();

function filePath() {
  return path.resolve(env.dataDir, 'commerce-store.json');
}

function persist() {
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify({
    products, orders, events,
    wallets: [...wallets.values()],
    rules: [...rules.entries()],
    mods: [...mods.entries()],
  }), { mode: 0o600 });
}

try {
  const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  products.push(...(parsed.products || []));
  orders.push(...(parsed.orders || []));
  events.push(...(parsed.events || []));
  for (const w of parsed.wallets || []) wallets.set(w.userId, w);
  for (const [id, text] of parsed.rules || []) rules.set(id, text);
  for (const [id, list] of parsed.mods || []) mods.set(id, list);
} catch {
  // first boot
}

export const commerceStore = {
  listProducts() { return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  getProduct(id: string) { return products.find((p) => p.id === id) || null; },
  createProduct(sellerId: string, title: string, description: string, price: number) {
    const product: Product = { id: crypto.randomUUID(), sellerId, title, description, price, createdAt: new Date().toISOString() };
    products.unshift(product); persist(); return product;
  },
  createOrder(product: Product, buyerId: string) {
    const order: Order = {
      id: crypto.randomUUID(),
      productId: product.id,
      buyerId,
      sellerId: product.sellerId,
      status: 'awaiting_payment',
      createdAt: new Date().toISOString(),
    };
    orders.unshift(order); persist(); return order;
  },
  listOrders(userId: string) {
    return orders.filter((o) => o.buyerId === userId || o.sellerId === userId);
  },
  listEvents() { return [...events]; },
  createEvent(ownerId: string, title: string, details: string, startsAt: string) {
    const item: EventItem = { id: crypto.randomUUID(), ownerId, title, details, startsAt, createdAt: new Date().toISOString() };
    events.unshift(item); persist(); return item;
  },
  wallet(userId: string) {
    if (!wallets.has(userId)) wallets.set(userId, { userId, coins: 0 });
    return wallets.get(userId)!;
  },
  setRules(communityId: string, text: string) { rules.set(communityId, text.slice(0, 4000)); persist(); return rules.get(communityId) || ''; },
  getRules(communityId: string) { return rules.get(communityId) || ''; },
  setMods(communityId: string, userIds: string[]) { mods.set(communityId, userIds); persist(); return userIds; },
  getMods(communityId: string) { return mods.get(communityId) || []; },
};
