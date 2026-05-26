// routes/inbox.routes.ts
import { Router } from 'express';
import authorize from '../middlewares/auth.middleware';
import {
  // Conversations
  getConversations,
  createConversation,
  getConversation,
  archiveConversation,
  // Messages
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  // Notifications
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  // Mentions
  sendPageMention,
  getMentionableUsers,
} from '../controllers/inbox.controller';

const inboxRouter = Router();

// All inbox routes require authentication
inboxRouter.use(authorize);

// ── Conversations ──────────────────────────────────────────────────────────
inboxRouter
  .route('/conversations')
  .get(getConversations)
  .post(createConversation);

inboxRouter
  .route('/conversations/:id')
  .get(getConversation)
  .delete(archiveConversation);

// ── Messages ───────────────────────────────────────────────────────────────
inboxRouter
  .route('/conversations/:id/messages')
  .get(getMessages)
  .post(sendMessage);

inboxRouter
  .route('/conversations/:id/messages/:msgId')
  .patch(editMessage)
  .delete(deleteMessage);

inboxRouter.post('/conversations/:id/read', markConversationRead);

// ── Notifications ──────────────────────────────────────────────────────────
// NOTE: /unread-count and /read-all must come before /:id to avoid
// the dynamic segment swallowing these literal routes
inboxRouter.get('/notifications/unread-count', getUnreadCount);
inboxRouter.post('/notifications/read-all', markAllNotificationsRead);

inboxRouter.get('/notifications', getNotifications);
inboxRouter.patch('/notifications/:id/read', markNotificationRead);

// ── Mentions ───────────────────────────────────────────────────────────────
inboxRouter.post('/mention', sendPageMention);
inboxRouter.get('/mentionable-users', getMentionableUsers);

export default inboxRouter;