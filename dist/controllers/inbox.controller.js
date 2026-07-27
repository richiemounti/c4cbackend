"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMentionableUsers = exports.sendPageMention = exports.markAllNotificationsRead = exports.markNotificationRead = exports.getUnreadCount = exports.getNotifications = exports.markConversationRead = exports.deleteMessage = exports.editMessage = exports.sendMessage = exports.getMessages = exports.archiveConversation = exports.getConversation = exports.createConversation = exports.getConversations = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const conversation_model_1 = __importDefault(require("../models/conversation.model"));
const message_model_1 = __importDefault(require("../models/message.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const socket_service_1 = require("../services/socket.service");
// Mirrors the pattern used in project.controller.ts
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Verify the current user is a participant in the given conversation.
 * Throws a 403 if not.
 */
function assertParticipant(conversationId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const conversation = yield conversation_model_1.default.findOne({
            _id: conversationId,
            participants: userId,
            archived: false,
        });
        if (!conversation) {
            const error = new Error('Conversation not found or access denied');
            error.statusCode = 403;
            throw error;
        }
        return conversation;
    });
}
/**
 * Create and emit a notification to the recipient's inbox room.
 */
function createNotification(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const notification = yield notification_model_1.default.create(params);
        yield notification.populate('triggeredBy', 'name photo userName');
        (0, socket_service_1.emitToUser)(params.recipient.toString(), 'notification', notification);
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/inbox/conversations
 * List all conversations for the current user, sorted by most recent activity.
 */
const getConversations = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const conversations = yield conversation_model_1.default.find({
            participants: userId,
            archived: false,
            archivedBy: { $ne: userId },
        })
            .sort({ lastActivityAt: -1 })
            .limit(50)
            .populate('participants', 'name email photo userName primaryRole')
            .populate('createdBy', 'name photo userName')
            .populate({
            path: 'lastMessage',
            select: 'content sender createdAt deleted',
            populate: { path: 'sender', select: 'name photo userName' },
        })
            .lean();
        // Compute unread count per conversation for this user
        const conversationIds = conversations.map((c) => c._id);
        const unreadCounts = yield message_model_1.default.aggregate([
            {
                $match: {
                    conversation: { $in: conversationIds },
                    deleted: false,
                    'readBy.user': { $ne: new mongoose_1.default.Types.ObjectId(userId) },
                    sender: { $ne: new mongoose_1.default.Types.ObjectId(userId) },
                },
            },
            { $group: { _id: '$conversation', count: { $sum: 1 } } },
        ]);
        const unreadMap = new Map(unreadCounts.map((u) => [u._id.toString(), u.count]));
        const enriched = conversations.map((c) => {
            var _a;
            return (Object.assign(Object.assign({}, c), { unreadCount: (_a = unreadMap.get(c._id.toString())) !== null && _a !== void 0 ? _a : 0 }));
        });
        res.status(200).json({
            success: true,
            count: enriched.length,
            data: enriched,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getConversations = getConversations;
/**
 * POST /api/v1/inbox/conversations
 * Create a new direct or group conversation.
 * For direct conversations, returns the existing one if it already exists.
 */
const createConversation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { type, participantIds, name, organizationId, projectId } = req.body;
        const userId = req.user._id.toString();
        const isStaff = req.user.isConnectGoStaff;
        if (!type || !participantIds || (!organizationId && !isStaff)) {
            const error = new Error('type, participantIds, and organizationId are required');
            error.statusCode = 400;
            throw error;
        }
        // For staff without an explicit org, derive it from the first non-staff participant
        let resolvedOrgId = organizationId;
        if (!resolvedOrgId && isStaff) {
            const firstParticipant = yield user_model_1.default.findById(participantIds[0]).select('roles isConnectGoStaff');
            const orgFromParticipant = (_b = (_a = firstParticipant === null || firstParticipant === void 0 ? void 0 : firstParticipant.roles) === null || _a === void 0 ? void 0 : _a.find((r) => r.organization)) === null || _b === void 0 ? void 0 : _b.organization;
            if (!orgFromParticipant) {
                const error = new Error('Cannot determine organisation from participants — please provide organizationId');
                error.statusCode = 400;
                throw error;
            }
            resolvedOrgId = orgFromParticipant.toString();
        }
        // Always include the creator in participants
        const allParticipantIds = [...new Set([userId, ...participantIds])];
        // Verify every non-staff participant belongs to the resolved organisation
        const orgUsers = yield user_model_1.default.find({
            _id: { $in: allParticipantIds },
            archived: false,
        }).select('_id roles isConnectGoStaff');
        const invalidUsers = orgUsers.filter((u) => !u.isConnectGoStaff &&
            !u.roles.some((r) => r.organization && r.organization.toString() === resolvedOrgId));
        if (invalidUsers.length > 0) {
            const error = new Error('All participants must belong to the same organisation');
            error.statusCode = 400;
            throw error;
        }
        // ── Direct conversation ───────────────────────────────────────────────
        if (type === 'direct') {
            if (allParticipantIds.length !== 2) {
                const error = new Error('Direct conversations must have exactly 2 participants');
                error.statusCode = 400;
                throw error;
            }
            // Return existing DM if one already exists between these two users
            const existing = yield conversation_model_1.default.findOne({
                type: 'direct',
                organization: resolvedOrgId,
                participants: {
                    $all: allParticipantIds.map((id) => new mongoose_1.default.Types.ObjectId(id)),
                    $size: 2,
                },
                archived: false,
            }).populate('participants', 'name email photo userName primaryRole');
            if (existing) {
                // Un-archive for the requesting user if they had previously hidden it
                if (existing.archivedBy.some((id) => id.toString() === userId)) {
                    yield conversation_model_1.default.findByIdAndUpdate(existing._id, {
                        $pull: { archivedBy: userId },
                    });
                }
                return res.status(200).json({ success: true, data: existing });
            }
        }
        // ── Group conversation ────────────────────────────────────────────────
        if (type === 'group' && !name) {
            const error = new Error('Group conversations require a name');
            error.statusCode = 400;
            throw error;
        }
        const conversation = yield conversation_model_1.default.create({
            organization: resolvedOrgId,
            project: projectId || null,
            type,
            name: type === 'group' ? name : undefined,
            participants: allParticipantIds,
            createdBy: userId,
            lastActivityAt: new Date(),
        });
        const populated = yield conversation.populate('participants', 'name email photo userName primaryRole');
        res.status(201).json({ success: true, data: populated });
    }
    catch (error) {
        next(error);
    }
});
exports.createConversation = createConversation;
/**
 * GET /api/v1/inbox/conversations/:id
 * Get a single conversation with its first page of messages.
 */
const getConversation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id } = req.params;
        const conversation = yield conversation_model_1.default.findOne({
            _id: id,
            participants: userId,
            archived: false,
        })
            .populate('participants', 'name email photo userName primaryRole')
            .populate('createdBy', 'name photo userName')
            .lean();
        if (!conversation) {
            const error = new Error('Conversation not found or access denied');
            error.statusCode = 404;
            throw error;
        }
        // Fetch first page of messages (newest 30, returned in chronological order)
        const messages = yield message_model_1.default.find({
            conversation: id,
            deleted: false,
        })
            .sort({ createdAt: -1 })
            .limit(30)
            .populate('sender', 'name photo userName')
            .populate('mentions', 'name photo userName')
            .lean();
        // Mark all unread messages in this conversation as read
        yield message_model_1.default.updateMany({
            conversation: id,
            deleted: false,
            'readBy.user': { $ne: new mongoose_1.default.Types.ObjectId(userId) },
            sender: { $ne: new mongoose_1.default.Types.ObjectId(userId) },
        }, {
            $push: {
                readBy: {
                    user: new mongoose_1.default.Types.ObjectId(userId),
                    readAt: new Date(),
                },
            },
        });
        (0, socket_service_1.emitToConversation)(id, 'messages_read', {
            conversationId: id,
            readBy: userId,
            readAt: new Date(),
        });
        res.status(200).json({
            success: true,
            data: {
                conversation,
                messages: messages.reverse(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getConversation = getConversation;
/**
 * DELETE /api/v1/inbox/conversations/:id
 * Soft-archive a conversation for the current user only.
 */
const archiveConversation = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id } = req.params;
        yield assertParticipant(id, userId);
        yield conversation_model_1.default.findByIdAndUpdate(id, {
            $addToSet: { archivedBy: userId },
        });
        res.status(200).json({ success: true, message: 'Conversation archived successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.archiveConversation = archiveConversation;
// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/inbox/conversations/:id/messages
 * Paginated message history. Uses cursor-based pagination via `before`
 * (a message createdAt ISO timestamp).
 */
const getMessages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id } = req.params;
        const { before, limit = '30' } = req.query;
        yield assertParticipant(id, userId);
        const pageLimit = Math.min(parseInt(limit, 10) || 30, 100);
        const query = {
            conversation: id,
            deleted: false,
        };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        const messages = yield message_model_1.default.find(query)
            .sort({ createdAt: -1 })
            .limit(pageLimit)
            .populate('sender', 'name photo userName')
            .populate('mentions', 'name photo userName')
            .lean();
        res.status(200).json({
            success: true,
            hasMore: messages.length === pageLimit,
            count: messages.length,
            data: messages.reverse(),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMessages = getMessages;
/**
 * POST /api/v1/inbox/conversations/:id/messages
 * Send a message in a conversation.
 */
const sendMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id: conversationId } = req.params;
        const { content, mentionIds, contextLink } = req.body;
        if (!content || !content.trim()) {
            const error = new Error('Message content is required');
            error.statusCode = 400;
            throw error;
        }
        const conversation = yield assertParticipant(conversationId, userId);
        const message = yield message_model_1.default.create({
            conversation: conversationId,
            organization: conversation.organization,
            sender: userId,
            content: content.trim(),
            mentions: mentionIds || [],
            contextLink: contextLink || null,
            readBy: [{ user: userId, readAt: new Date() }],
        });
        // Update conversation metadata and un-hide for all participants
        yield conversation_model_1.default.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
            lastActivityAt: new Date(),
            $set: { archivedBy: [] },
        });
        yield message.populate('sender', 'name photo userName');
        yield message.populate('mentions', 'name photo userName');
        (0, socket_service_1.emitToConversation)(conversationId, 'new_message', message);
        // ── Notifications ─────────────────────────────────────────────────────
        const participants = conversation.participants
            .map((p) => p.toString())
            .filter((p) => p !== userId);
        const preview = `${req.user.name}: ` +
            (content.length > 100 ? content.substring(0, 100) + '...' : content);
        const mentionedIds = (mentionIds || []).filter((id) => id !== userId);
        // Mention notifications for @mentioned users
        for (const mentionedId of mentionedIds) {
            yield createNotification({
                recipient: new mongoose_1.default.Types.ObjectId(mentionedId),
                organization: conversation.organization,
                type: 'mention_in_message',
                triggeredBy: new mongoose_1.default.Types.ObjectId(userId),
                conversation: conversation._id,
                message: message._id,
                contextLink: contextLink || undefined,
                preview,
            });
        }
        // New message notification for non-mentioned participants
        const nonMentionedParticipants = participants.filter((p) => !mentionedIds.includes(p));
        for (const participantId of nonMentionedParticipants) {
            yield createNotification({
                recipient: new mongoose_1.default.Types.ObjectId(participantId),
                organization: conversation.organization,
                type: 'new_message',
                triggeredBy: new mongoose_1.default.Types.ObjectId(userId),
                conversation: conversation._id,
                message: message._id,
                preview,
            });
        }
        res.status(201).json({ success: true, data: message });
    }
    catch (error) {
        next(error);
    }
});
exports.sendMessage = sendMessage;
/**
 * PATCH /api/v1/inbox/conversations/:id/messages/:msgId
 * Edit a message. Only the original sender can edit.
 */
const editMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id: conversationId, msgId } = req.params;
        const { content } = req.body;
        if (!content || !content.trim()) {
            const error = new Error('Message content is required');
            error.statusCode = 400;
            throw error;
        }
        yield assertParticipant(conversationId, userId);
        const message = yield message_model_1.default.findOne({
            _id: msgId,
            conversation: conversationId,
            sender: userId,
            deleted: false,
        });
        if (!message) {
            const error = new Error('Message not found or you are not the sender');
            error.statusCode = 404;
            throw error;
        }
        message.content = content.trim();
        message.editedAt = new Date();
        yield message.save();
        yield message.populate('sender', 'name photo userName');
        (0, socket_service_1.emitToConversation)(conversationId, 'message_edited', message);
        res.status(200).json({ success: true, data: message });
    }
    catch (error) {
        next(error);
    }
});
exports.editMessage = editMessage;
/**
 * DELETE /api/v1/inbox/conversations/:id/messages/:msgId
 * Soft-delete a message. Sender can delete their own; ConnectGo staff can delete any.
 */
const deleteMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id: conversationId, msgId } = req.params;
        yield assertParticipant(conversationId, userId);
        const filter = {
            _id: msgId,
            conversation: conversationId,
            deleted: false,
        };
        // ConnectGo staff can delete any message; regular users only their own
        if (!req.user.isConnectGoStaff) {
            filter.sender = userId;
        }
        const message = yield message_model_1.default.findOneAndUpdate(filter, { deleted: true, deletedAt: new Date(), content: '[Message deleted]' }, { new: true });
        if (!message) {
            const error = new Error('Message not found or you are not authorized to delete it');
            error.statusCode = 404;
            throw error;
        }
        (0, socket_service_1.emitToConversation)(conversationId, 'message_deleted', {
            messageId: msgId,
            conversationId,
        });
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteMessage = deleteMessage;
/**
 * POST /api/v1/inbox/conversations/:id/read
 * Mark all messages in a conversation as read for the current user.
 */
const markConversationRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id: conversationId } = req.params;
        yield assertParticipant(conversationId, userId);
        yield message_model_1.default.updateMany({
            conversation: conversationId,
            deleted: false,
            'readBy.user': { $ne: new mongoose_1.default.Types.ObjectId(userId) },
            sender: { $ne: new mongoose_1.default.Types.ObjectId(userId) },
        }, {
            $push: {
                readBy: {
                    user: new mongoose_1.default.Types.ObjectId(userId),
                    readAt: new Date(),
                },
            },
        });
        (0, socket_service_1.emitToConversation)(conversationId, 'messages_read', {
            conversationId,
            readBy: userId,
            readAt: new Date(),
        });
        res.status(200).json({ success: true, message: 'Conversation marked as read' });
    }
    catch (error) {
        next(error);
    }
});
exports.markConversationRead = markConversationRead;
// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/inbox/notifications
 * List notifications for the current user, newest first.
 */
const getNotifications = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { page = '1', limit = '20', unreadOnly } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const pageLimit = Math.min(parseInt(limit, 10) || 20, 50);
        const skip = (pageNum - 1) * pageLimit;
        const filter = { recipient: userId };
        if (unreadOnly === 'true') {
            filter.read = false;
        }
        const [notifications, total] = yield Promise.all([
            notification_model_1.default.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageLimit)
                .populate('triggeredBy', 'name photo userName')
                .lean(),
            notification_model_1.default.countDocuments(filter),
        ]);
        res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / pageLimit),
            data: notifications,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getNotifications = getNotifications;
/**
 * GET /api/v1/inbox/notifications/unread-count
 * Returns unread notification + message counts for the nav badge.
 */
const getUnreadCount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const [unreadNotifications, unreadMessages] = yield Promise.all([
            notification_model_1.default.countDocuments({ recipient: userId, read: false }),
            message_model_1.default.aggregate([
                {
                    $match: {
                        deleted: false,
                        'readBy.user': { $ne: new mongoose_1.default.Types.ObjectId(userId) },
                        sender: { $ne: new mongoose_1.default.Types.ObjectId(userId) },
                    },
                },
                {
                    $lookup: {
                        from: 'conversations',
                        localField: 'conversation',
                        foreignField: '_id',
                        as: 'conv',
                    },
                },
                { $unwind: '$conv' },
                {
                    $match: {
                        'conv.participants': new mongoose_1.default.Types.ObjectId(userId),
                        'conv.archived': false,
                        'conv.archivedBy': { $ne: new mongoose_1.default.Types.ObjectId(userId) },
                    },
                },
                { $group: { _id: '$conversation' } },
                { $count: 'total' },
            ]),
        ]);
        const unreadMessageConversations = unreadMessages.length > 0 ? unreadMessages[0].total : 0;
        res.status(200).json({
            success: true,
            data: {
                notifications: unreadNotifications,
                messages: unreadMessageConversations,
                total: unreadNotifications + unreadMessageConversations,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUnreadCount = getUnreadCount;
/**
 * PATCH /api/v1/inbox/notifications/:id/read
 * Mark a single notification as read.
 */
const markNotificationRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { id } = req.params;
        const notification = yield notification_model_1.default.findOneAndUpdate({ _id: id, recipient: userId }, { read: true, readAt: new Date() }, { new: true });
        if (!notification) {
            const error = new Error('Notification not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({ success: true, data: notification });
    }
    catch (error) {
        next(error);
    }
});
exports.markNotificationRead = markNotificationRead;
/**
 * POST /api/v1/inbox/notifications/read-all
 * Mark all notifications as read for the current user.
 */
const markAllNotificationsRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        yield notification_model_1.default.updateMany({ recipient: userId, read: false }, { read: true, readAt: new Date() });
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    }
    catch (error) {
        next(error);
    }
});
exports.markAllNotificationsRead = markAllNotificationsRead;
// ─────────────────────────────────────────────────────────────────────────────
// MENTIONS (page-level, not inside a chat)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/inbox/mention
 * Send a contextual mention from anywhere on the platform — risk register,
 * report, review, etc. Creates a notification directly without involving
 * the conversation system.
 */
const sendPageMention = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const userId = req.user._id.toString();
        const { recipientIds, organizationId, preview, pageContext, contextLink } = req.body;
        if (!(recipientIds === null || recipientIds === void 0 ? void 0 : recipientIds.length) || !organizationId || !preview || !pageContext) {
            const error = new Error('recipientIds, organizationId, preview, and pageContext are required');
            error.statusCode = 400;
            throw error;
        }
        let sent = 0;
        for (const recipientId of recipientIds) {
            if (recipientId === userId)
                continue; // never notify yourself
            yield createNotification({
                recipient: new mongoose_1.default.Types.ObjectId(recipientId),
                organization: new mongoose_1.default.Types.ObjectId(organizationId),
                type: 'mention_on_page',
                triggeredBy: new mongoose_1.default.Types.ObjectId(userId),
                pageContext,
                contextLink: contextLink || undefined,
                preview,
            });
            sent++;
        }
        res.status(201).json({
            success: true,
            message: `${sent} mention(s) sent successfully`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.sendPageMention = sendPageMention;
/**
 * GET /api/v1/inbox/mentionable-users
 * Search for users in the same organisation to @mention.
 * Query params: search, organizationId, limit
 */
const getMentionableUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { search, organizationId, limit = '10' } = req.query;
        const isStaff = req.user.isConnectGoStaff;
        if (!organizationId && !isStaff) {
            const error = new Error('organizationId is required');
            error.statusCode = 400;
            throw error;
        }
        const pageLimit = Math.min(parseInt(limit, 10) || 10, 25);
        const filter = {
            archived: false,
            _id: { $ne: req.user._id },
        };
        if (!isStaff && organizationId) {
            filter.$or = [
                { isConnectGoStaff: true },
                { 'roles.organization': new mongoose_1.default.Types.ObjectId(organizationId) },
            ];
        }
        ;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$and = [
                {
                    $or: [
                        { name: searchRegex },
                        { userName: searchRegex },
                        { email: searchRegex },
                    ],
                },
            ];
        }
        const users = yield user_model_1.default.find(filter)
            .select('name userName email photo primaryRole')
            .limit(pageLimit)
            .lean();
        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMentionableUsers = getMentionableUsers;
//# sourceMappingURL=inbox.controller.js.map