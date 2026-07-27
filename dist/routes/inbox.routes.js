"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/inbox.routes.ts
const express_1 = require("express");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const inbox_controller_1 = require("../controllers/inbox.controller");
const inboxRouter = (0, express_1.Router)();
// All inbox routes require authentication
inboxRouter.use(auth_middleware_1.default);
// ── Conversations ──────────────────────────────────────────────────────────
inboxRouter
    .route('/conversations')
    .get(inbox_controller_1.getConversations)
    .post(inbox_controller_1.createConversation);
inboxRouter
    .route('/conversations/:id')
    .get(inbox_controller_1.getConversation)
    .delete(inbox_controller_1.archiveConversation);
// ── Messages ───────────────────────────────────────────────────────────────
inboxRouter
    .route('/conversations/:id/messages')
    .get(inbox_controller_1.getMessages)
    .post(inbox_controller_1.sendMessage);
inboxRouter
    .route('/conversations/:id/messages/:msgId')
    .patch(inbox_controller_1.editMessage)
    .delete(inbox_controller_1.deleteMessage);
inboxRouter.post('/conversations/:id/read', inbox_controller_1.markConversationRead);
// ── Notifications ──────────────────────────────────────────────────────────
// NOTE: /unread-count and /read-all must come before /:id to avoid
// the dynamic segment swallowing these literal routes
inboxRouter.get('/notifications/unread-count', inbox_controller_1.getUnreadCount);
inboxRouter.post('/notifications/read-all', inbox_controller_1.markAllNotificationsRead);
inboxRouter.get('/notifications', inbox_controller_1.getNotifications);
inboxRouter.patch('/notifications/:id/read', inbox_controller_1.markNotificationRead);
// ── Mentions ───────────────────────────────────────────────────────────────
inboxRouter.post('/mention', inbox_controller_1.sendPageMention);
inboxRouter.get('/mentionable-users', inbox_controller_1.getMentionableUsers);
exports.default = inboxRouter;
//# sourceMappingURL=inbox.routes.js.map