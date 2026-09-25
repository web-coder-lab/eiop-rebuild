import { Router } from 'express';
import { AppError } from '../../core/errors.js';
import { ok } from '../../core/http.js';
import { assertOwner } from '../../core/authorization.js';
import { requireAuth } from '../../middleware/auth.js';
import { authStore, publicUser } from '../auth/store.js';
import { contentStore } from './store.js';

export const contentRouter = Router();

function rid(res: { locals: { requestId?: string } }) {
  return String(res.locals.requestId || '');
}

function authorCard(userId: string) {
  const user = authStore.findById(userId);
  return user ? publicUser(user) : { id: userId, username: 'unknown', fullName: 'Unknown' };
}

function presentPost(post: ReturnType<typeof contentStore.getPost>, viewerId?: string) {
  if (!post) return null;
  return {
    ...post,
    author: authorCard(post.authorId),
    likeCount: post.likedBy.length,
    liked: viewerId ? post.likedBy.includes(viewerId) : false,
    saved: viewerId ? post.savedBy.includes(viewerId) : false,
    likedBy: undefined,
    savedBy: undefined,
  };
}

contentRouter.get('/feed', (req, res) => {
  const viewer = req.auth?.userId;
  ok(res, contentStore.listPublicPosts().map((p) => presentPost(p, viewer)), rid(res));
});

contentRouter.get('/posts/:id', (req, res, next) => {
  const post = contentStore.getPost(String(req.params.id));
  if (!post) return next(new AppError(404, 'NOT_FOUND', 'Post not found.'));
  ok(res, presentPost(post, req.auth?.userId), rid(res));
});

contentRouter.post('/posts', requireAuth, (req, res, next) => {
  const content = String(req.body?.content || '').trim().slice(0, 4000);
  if (content.length < 1) return next(new AppError(400, 'VALIDATION_ERROR', 'Write something first.'));
  const post = contentStore.createPost(req.auth!.userId, content, req.body?.audience === 'followers' ? 'followers' : 'public');
  ok(res, presentPost(post, req.auth!.userId), rid(res), 201);
});

contentRouter.delete('/posts/:id', requireAuth, (req, res, next) => {
  const post = contentStore.getPost(String(req.params.id));
  if (!post) return next(new AppError(404, 'NOT_FOUND', 'Post not found.'));
  assertOwner(post.authorId, req.auth!.userId);
  contentStore.deletePost(post.id);
  ok(res, { deleted: true }, rid(res));
});

contentRouter.post('/posts/:id/reactions', requireAuth, (req, res, next) => {
  const post = contentStore.toggleLike(String(req.params.id), req.auth!.userId);
  if (!post) return next(new AppError(404, 'NOT_FOUND', 'Post not found.'));
  ok(res, presentPost(post, req.auth!.userId), rid(res));
});

contentRouter.post('/posts/:id/save', requireAuth, (req, res, next) => {
  const post = contentStore.toggleSave(String(req.params.id), req.auth!.userId);
  if (!post) return next(new AppError(404, 'NOT_FOUND', 'Post not found.'));
  ok(res, presentPost(post, req.auth!.userId), rid(res));
});

contentRouter.get('/saved', requireAuth, (req, res) => {
  ok(res, contentStore.savedPosts(req.auth!.userId).map((p) => presentPost(p, req.auth!.userId)), rid(res));
});

contentRouter.get('/communities', (_req, res) => {
  ok(res, contentStore.listCommunities(), rid(res));
});

contentRouter.get('/communities/:id', (req, res, next) => {
  const community = contentStore.getCommunity(String(req.params.id));
  if (!community) return next(new AppError(404, 'NOT_FOUND', 'Community not found.'));
  ok(res, { ...community, owner: authorCard(community.ownerId) }, rid(res));
});

contentRouter.post('/communities', requireAuth, (req, res, next) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const description = String(req.body?.description || '').trim().slice(0, 400);
  if (name.length < 3) return next(new AppError(400, 'VALIDATION_ERROR', 'Community name is too short.'));
  ok(res, contentStore.createCommunity(req.auth!.userId, name, description), rid(res), 201);
});

contentRouter.post('/communities/:id/join', requireAuth, (req, res, next) => {
  const community = contentStore.joinCommunity(String(req.params.id), req.auth!.userId);
  if (!community) return next(new AppError(404, 'NOT_FOUND', 'Community not found.'));
  ok(res, community, rid(res));
});

contentRouter.post('/communities/:id/leave', requireAuth, (req, res, next) => {
  const community = contentStore.getCommunity(String(req.params.id));
  if (!community) return next(new AppError(404, 'NOT_FOUND', 'Community not found.'));
  if (community.ownerId === req.auth!.userId) return next(new AppError(409, 'CONFLICT', 'Owners cannot leave. Transfer first.'));
  ok(res, contentStore.leaveCommunity(community.id, req.auth!.userId), rid(res));
});

contentRouter.get('/conversations', requireAuth, (req, res) => {
  ok(res, contentStore.listConversations(req.auth!.userId).map((c) => ({
    ...c,
    members: c.memberIds.map(authorCard),
  })), rid(res));
});

contentRouter.post('/conversations', requireAuth, (req, res, next) => {
  const otherId = String(req.body?.userId || '');
  if (!authStore.findById(otherId)) return next(new AppError(404, 'NOT_FOUND', 'User not found.'));
  const conv = contentStore.openConversation(req.auth!.userId, otherId);
  ok(res, { ...conv, members: conv.memberIds.map(authorCard) }, rid(res));
});

contentRouter.get('/conversations/:id/messages', requireAuth, (req, res, next) => {
  const conv = contentStore.getConversation(String(req.params.id));
  if (!conv) return next(new AppError(404, 'NOT_FOUND', 'Conversation not found.'));
  if (!conv.memberIds.includes(req.auth!.userId)) return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
  ok(res, contentStore.listMessages(conv.id).map((m) => ({ ...m, author: authorCard(m.authorId) })), rid(res));
});

contentRouter.post('/conversations/:id/messages', requireAuth, (req, res, next) => {
  const conv = contentStore.getConversation(String(req.params.id));
  if (!conv) return next(new AppError(404, 'NOT_FOUND', 'Conversation not found.'));
  if (!conv.memberIds.includes(req.auth!.userId)) return next(new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
  const text = String(req.body?.text || '').trim().slice(0, 2000);
  if (!text) return next(new AppError(400, 'VALIDATION_ERROR', 'Message is empty.'));
  const message = contentStore.addMessage(conv.id, req.auth!.userId, text);
  const other = conv.memberIds.find((id) => id !== req.auth!.userId);
  if (other) contentStore.notify(other, 'New message');
  ok(res, { ...message, author: authorCard(message.authorId) }, rid(res), 201);
});

contentRouter.get('/notifications', requireAuth, (req, res) => {
  ok(res, contentStore.listNotifications(req.auth!.userId), rid(res));
});

contentRouter.post('/notifications/read-all', requireAuth, (req, res) => {
  contentStore.markNotificationsRead(req.auth!.userId);
  ok(res, { read: true }, rid(res));
});

contentRouter.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const foundUsers = q
    ? authStore.listUsers()
        .filter((u) => `${u.username} ${u.fullName}`.toLowerCase().includes(q))
        .slice(0, 20)
        .map(publicUser)
    : [];
  const posts = contentStore.listPublicPosts().filter((p) => !q || p.content.toLowerCase().includes(q)).slice(0, 20);
  const communities = contentStore.listCommunities().filter((c) => !q || `${c.name} ${c.description}`.toLowerCase().includes(q)).slice(0, 20);
  ok(res, { posts: posts.map((p) => presentPost(p, req.auth?.userId)), communities, users: foundUsers }, rid(res));
});

contentRouter.get('/users/:username', (req, res, next) => {
  const user = authStore.findByUsername(String(req.params.username || ''));
  if (!user) return next(new AppError(404, 'NOT_FOUND', 'User not found.'));
  ok(res, {
    user: publicUser(user),
    followers: contentStore.followers(user.id).length,
    following: contentStore.following(user.id).length,
    posts: contentStore.listPublicPosts().filter((p) => p.authorId === user.id).map((p) => presentPost(p, req.auth?.userId)),
  }, rid(res));
});

contentRouter.post('/users/:username/follow', requireAuth, (req, res, next) => {
  const user = authStore.findByUsername(String(req.params.username || ''));
  if (!user) return next(new AppError(404, 'NOT_FOUND', 'User not found.'));
  contentStore.follow(req.auth!.userId, user.id);
  contentStore.notify(user.id, `${req.auth!.userId} followed you`);
  ok(res, { following: true }, rid(res));
});

contentRouter.delete('/users/:username/follow', requireAuth, (req, res, next) => {
  const user = authStore.findByUsername(String(req.params.username || ''));
  if (!user) return next(new AppError(404, 'NOT_FOUND', 'User not found.'));
  contentStore.unfollow(req.auth!.userId, user.id);
  ok(res, { following: false }, rid(res));
});
