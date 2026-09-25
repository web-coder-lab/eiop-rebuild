import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';

export type Post = {
  id: string;
  authorId: string;
  content: string;
  audience: 'public' | 'followers';
  createdAt: string;
  savedBy: string[];
  likedBy: string[];
};

export type Community = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  memberIds: string[];
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  text: string;
  read: boolean;
  createdAt: string;
};

export type Follow = { followerId: string; targetId: string };

const posts: Post[] = [];
const communities: Community[] = [];
const conversations: Conversation[] = [];
const messages: ChatMessage[] = [];
const notifications: Notification[] = [];
const follows: Follow[] = [];

function filePath() {
  return path.resolve(env.dataDir, 'content-store.json');
}

function persist() {
  fs.mkdirSync(env.dataDir, { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify({ posts, communities, conversations, messages, notifications, follows }), { mode: 0o600 });
}

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    posts.push(...(parsed.posts || []));
    communities.push(...(parsed.communities || []));
    conversations.push(...(parsed.conversations || []));
    messages.push(...(parsed.messages || []));
    notifications.push(...(parsed.notifications || []));
    follows.push(...(parsed.follows || []));
  } catch {
    // first boot
  }
}

load();

export const contentStore = {
  listPublicPosts() {
    return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getPost(id: string) {
    return posts.find((p) => p.id === id) || null;
  },
  createPost(authorId: string, content: string, audience: Post['audience']) {
    const post: Post = {
      id: crypto.randomUUID(),
      authorId,
      content,
      audience,
      createdAt: new Date().toISOString(),
      savedBy: [],
      likedBy: [],
    };
    posts.unshift(post);
    persist();
    return post;
  },
  deletePost(id: string) {
    const i = posts.findIndex((p) => p.id === id);
    if (i >= 0) posts.splice(i, 1);
    persist();
  },
  toggleLike(postId: string, userId: string) {
    const post = this.getPost(postId);
    if (!post) return null;
    const i = post.likedBy.indexOf(userId);
    if (i >= 0) post.likedBy.splice(i, 1);
    else post.likedBy.push(userId);
    persist();
    return post;
  },
  toggleSave(postId: string, userId: string) {
    const post = this.getPost(postId);
    if (!post) return null;
    const i = post.savedBy.indexOf(userId);
    if (i >= 0) post.savedBy.splice(i, 1);
    else post.savedBy.push(userId);
    persist();
    return post;
  },
  savedPosts(userId: string) {
    return posts.filter((p) => p.savedBy.includes(userId));
  },
  listCommunities() {
    return [...communities].sort((a, b) => a.name.localeCompare(b.name));
  },
  getCommunity(id: string) {
    return communities.find((c) => c.id === id) || null;
  },
  createCommunity(ownerId: string, name: string, description: string) {
    const community: Community = {
      id: crypto.randomUUID(),
      name,
      description,
      ownerId,
      memberIds: [ownerId],
      createdAt: new Date().toISOString(),
    };
    communities.push(community);
    persist();
    return community;
  },
  joinCommunity(id: string, userId: string) {
    const community = this.getCommunity(id);
    if (!community) return null;
    if (!community.memberIds.includes(userId)) community.memberIds.push(userId);
    persist();
    return community;
  },
  leaveCommunity(id: string, userId: string) {
    const community = this.getCommunity(id);
    if (!community) return null;
    community.memberIds = community.memberIds.filter((m) => m !== userId);
    persist();
    return community;
  },
  isMember(id: string, userId: string) {
    return Boolean(this.getCommunity(id)?.memberIds.includes(userId));
  },
  listConversations(userId: string) {
    return conversations.filter((c) => c.memberIds.includes(userId));
  },
  getConversation(id: string) {
    return conversations.find((c) => c.id === id) || null;
  },
  openConversation(userId: string, otherId: string) {
    let conv = conversations.find((c) => c.memberIds.includes(userId) && c.memberIds.includes(otherId) && c.memberIds.length === 2);
    if (!conv) {
      conv = { id: crypto.randomUUID(), memberIds: [userId, otherId], createdAt: new Date().toISOString() };
      conversations.push(conv);
      persist();
    }
    return conv;
  },
  listMessages(conversationId: string) {
    return messages.filter((m) => m.conversationId === conversationId);
  },
  addMessage(conversationId: string, authorId: string, text: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      authorId,
      text,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    persist();
    return message;
  },
  notify(userId: string, text: string) {
    notifications.unshift({
      id: crypto.randomUUID(),
      userId,
      text,
      read: false,
      createdAt: new Date().toISOString(),
    });
    persist();
  },
  listNotifications(userId: string) {
    return notifications.filter((n) => n.userId === userId);
  },
  markNotificationsRead(userId: string) {
    for (const n of notifications) if (n.userId === userId) n.read = true;
    persist();
  },
  follow(followerId: string, targetId: string) {
    if (followerId === targetId) return;
    if (!follows.some((f) => f.followerId === followerId && f.targetId === targetId)) {
      follows.push({ followerId, targetId });
      persist();
    }
  },
  unfollow(followerId: string, targetId: string) {
    const i = follows.findIndex((f) => f.followerId === followerId && f.targetId === targetId);
    if (i >= 0) follows.splice(i, 1);
    persist();
  },
  followers(userId: string) {
    return follows.filter((f) => f.targetId === userId).map((f) => f.followerId);
  },
  following(userId: string) {
    return follows.filter((f) => f.followerId === userId).map((f) => f.targetId);
  },
};
