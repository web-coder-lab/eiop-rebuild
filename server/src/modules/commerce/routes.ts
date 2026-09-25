import { Router } from 'express';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { assertOwner } from '../../core/authorization.js';
import { contentStore } from '../content/store.js';
import { authStore, publicUser } from '../auth/store.js';
import { firebaseApp } from '../../integrations/firebase/admin.js';
import { commerceStore } from './store.js';

export const commerceRouter = Router();

function rid(res: { locals: { requestId?: string } }) {
  return String(res.locals.requestId || '');
}

function person(id: string) {
  const user = authStore.findById(id);
  return user ? publicUser(user) : { id, username: 'unknown', fullName: 'Unknown' };
}

commerceRouter.get('/products', (_req, res) => {
  ok(res, commerceStore.listProducts().map((p) => ({ ...p, seller: person(p.sellerId) })), rid(res));
});

commerceRouter.get('/products/:id', (req, res, next) => {
  const product = commerceStore.getProduct(String(req.params.id));
  if (!product) return next(new AppError(404, 'NOT_FOUND', 'Product not found.'));
  ok(res, { ...product, seller: person(product.sellerId) }, rid(res));
});

commerceRouter.post('/products', requireAuth, (req, res, next) => {
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const description = String(req.body?.description || '').trim().slice(0, 500);
  const price = Number(req.body?.price);
  if (title.length < 3) return next(new AppError(400, 'VALIDATION_ERROR', 'Product title is too short.'));
  if (!Number.isFinite(price) || price < 0) return next(new AppError(400, 'VALIDATION_ERROR', 'Enter a valid price.'));
  ok(res, commerceStore.createProduct(req.auth!.userId, title, description, price), rid(res), 201);
});

commerceRouter.post('/products/:id/buy', requireAuth, async (req, res, next) => {
  try {
    const product = commerceStore.getProduct(String(req.params.id));
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found.');
    if (product.sellerId === req.auth!.userId) throw new AppError(409, 'CONFLICT', 'You cannot buy your own listing.');
    const order = commerceStore.createOrder(product, req.auth!.userId);
    if (firebaseApp.configured()) {
      try {
        await firebaseApp.writePayment(order.id, {
          type: 'order',
          orderId: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          productId: order.productId,
          amount: product.price,
          status: order.status,
        });
      } catch {
        // Firestore may not exist yet; order still stored locally.
      }
    }
    ok(res, order, rid(res), 201);
  } catch (error) {
    next(error);
  }
});

commerceRouter.get('/orders', requireAuth, (req, res) => {
  ok(res, commerceStore.listOrders(req.auth!.userId), rid(res));
});

commerceRouter.get('/events', (_req, res) => {
  ok(res, commerceStore.listEvents().map((e) => ({ ...e, owner: person(e.ownerId) })), rid(res));
});

commerceRouter.post('/events', requireAuth, (req, res, next) => {
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const details = String(req.body?.details || '').trim().slice(0, 500);
  const startsAt = String(req.body?.startsAt || new Date().toISOString());
  if (title.length < 3) return next(new AppError(400, 'VALIDATION_ERROR', 'Event title is too short.'));
  ok(res, commerceStore.createEvent(req.auth!.userId, title, details, startsAt), rid(res), 201);
});

commerceRouter.get('/wallet', requireAuth, (req, res) => {
  ok(res, { ...commerceStore.wallet(req.auth!.userId), payments: firebaseApp.configured() ? 'firebase_ready' : 'NOT_CONFIGURED' }, rid(res));
});

commerceRouter.get('/coins/balance', requireAuth, (req, res) => {
  ok(res, { balance: commerceStore.wallet(req.auth!.userId).coins }, rid(res));
});

commerceRouter.get('/creator/dashboard', requireAuth, (req, res) => {
  const posts = contentStore.listPublicPosts().filter((p) => p.authorId === req.auth!.userId);
  ok(res, { posts: posts.length, likes: posts.reduce((n, p) => n + p.likedBy.length, 0) }, rid(res));
});

commerceRouter.get('/seller/dashboard', requireAuth, (req, res) => {
  const listings = commerceStore.listProducts().filter((p) => p.sellerId === req.auth!.userId);
  const sales = commerceStore.listOrders(req.auth!.userId).filter((o) => o.sellerId === req.auth!.userId);
  ok(res, { listings: listings.length, orders: sales.length }, rid(res));
});

commerceRouter.get('/communities/:id/control', requireAuth, (req, res, next) => {
  const community = contentStore.getCommunity(String(req.params.id));
  if (!community) return next(new AppError(404, 'NOT_FOUND', 'Community not found.'));
  const isStaff = community.ownerId === req.auth!.userId || commerceStore.getMods(community.id).includes(req.auth!.userId);
  if (!isStaff) return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
  ok(res, {
    community,
    rules: commerceStore.getRules(community.id),
    mods: commerceStore.getMods(community.id).map(person),
    members: community.memberIds.map(person),
  }, rid(res));
});

commerceRouter.patch('/communities/:id/rules', requireAuth, (req, res, next) => {
  const community = contentStore.getCommunity(String(req.params.id));
  if (!community) return next(new AppError(404, 'NOT_FOUND', 'Community not found.'));
  assertOwner(community.ownerId, req.auth!.userId);
  ok(res, { rules: commerceStore.setRules(community.id, String(req.body?.rules || '')) }, rid(res));
});

commerceRouter.get('/community-control', requireAuth, (req, res) => {
  const owned = contentStore.listCommunities().filter((c) => c.ownerId === req.auth!.userId || commerceStore.getMods(c.id).includes(req.auth!.userId));
  ok(res, owned, rid(res));
});
